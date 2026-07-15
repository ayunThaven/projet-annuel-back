import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { ContentStatus } from '../common/enums/content-status.enum';
import { SyncStatus } from '../common/enums/sync-status.enum';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { CurationItemEntity } from '../curation/entities/curation-item.entity';
import * as contentMapper from './mappers/content.mapper';
import * as curationMapper from './mappers/curation.mapper';
import { NotionClientService } from './notion-client.service';
import { NotionOAuthService } from './notion-oauth.service';
import { NotionSyncable } from './notion-syncable';
import {
  NotionApiError,
  NotionClientPort,
  NotionPage,
  NotionProperties,
} from './notion.types';

const PUSHABLE_SYNC_STATUSES = [SyncStatus.PENDING, SyncStatus.ERROR];

/** Bilan chiffre d'une operation de synchronisation. */
export interface SyncSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

const emptySummary = (): SyncSummary => ({
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
});

function mergeSummaries(...summaries: SyncSummary[]): SyncSummary {
  return summaries.reduce((total, current) => {
    total.created += current.created;
    total.updated += current.updated;
    total.skipped += current.skipped;
    total.errors += current.errors;
    return total;
  }, emptySummary());
}

/**
 * Orchestre la synchronisation bidirectionnelle entre l'application et Notion.
 *
 * Export (push)  : App -> Notion, idempotent via notionPageId.
 * Import (pull)  : Notion -> App, upsert par notionPageId + resolution de
 *                  conflit last-write-wins horodatee.
 */
@Injectable()
export class NotionSyncService {
  private readonly logger = new Logger(NotionSyncService.name);

  constructor(
    @InjectRepository(ContentItemEntity)
    private readonly contentRepository: Repository<ContentItemEntity>,
    @InjectRepository(CurationItemEntity)
    private readonly curationRepository: Repository<CurationItemEntity>,
    private readonly notionClient: NotionClientService,
    private readonly notionOAuth: NotionOAuthService,
    private readonly config: ConfigService,
  ) {}

  // --- Points d'entree par agence ---

  async pushAll(agency: AgencyEntity): Promise<SyncSummary> {
    return mergeSummaries(
      await this.pushContent(agency),
      await this.pushCuration(agency),
    );
  }

  async pullAll(agency: AgencyEntity): Promise<SyncSummary> {
    return mergeSummaries(
      await this.pullContent(agency),
      await this.pullCuration(agency),
    );
  }

  /**
   * Pousse vers la base Notion "Articles" (calendrier) : seuls les contenus
   * `SCHEDULED`/`PUBLISHED` y figurent. Un contenu qui repasse a un statut
   * anterieur alors qu'il a deja une page Notion voit cette page archivee au
   * lieu d'etre mise a jour (cf. `CALENDAR_ELIGIBLE_STATUSES`).
   */
  async pushContent(agency: AgencyEntity): Promise<SyncSummary> {
    const items = await this.contentRepository.find({
      where: [
        {
          syncStatus: In(PUSHABLE_SYNC_STATUSES),
          status: In(contentMapper.CALENDAR_ELIGIBLE_STATUSES),
        },
        {
          syncStatus: In(PUSHABLE_SYNC_STATUSES),
          notionPageId: Not(IsNull()),
        },
      ] as never,
    });

    return this.pushEntities(
      this.contentRepository,
      agency,
      items,
      (entity) => contentMapper.toNotionProperties(entity),
      (entity) =>
        contentMapper.CALENDAR_ELIGIBLE_STATUSES.includes(entity.status),
      (entity) => contentMapper.toNotionBody(entity),
    );
  }

  async pushCuration(agency: AgencyEntity): Promise<SyncSummary> {
    const items = await this.curationRepository.find({
      where: { syncStatus: In(PUSHABLE_SYNC_STATUSES) } as never,
    });

    return this.pushEntities(this.curationRepository, agency, items, (entity) =>
      curationMapper.toNotionProperties(entity),
    );
  }

  async pullContent(agency: AgencyEntity): Promise<SyncSummary> {
    return this.pullItems(
      this.contentRepository,
      agency,
      (entity, page) => {
        const isNewEntity = !entity.id;
        Object.assign(entity, contentMapper.fromNotionPage(page));

        // Une page creee directement dans Notion n'a pas de statut applicatif :
        // on la considere planifiee si elle porte une date, brouillon sinon.
        if (isNewEntity) {
          entity.status = entity.publicationDate
            ? ContentStatus.SCHEDULED
            : ContentStatus.DRAFT;
        }
      },
      () => this.contentRepository.create({ agency }),
    );
  }

  async pullCuration(agency: AgencyEntity): Promise<SyncSummary> {
    return this.pullItems(
      this.curationRepository,
      agency,
      (entity, page) =>
        Object.assign(entity, curationMapper.fromNotionPage(page)),
      () => this.curationRepository.create({ agency }),
    );
  }

  // --- Coeur generique ---

  private async pushEntities<T extends NotionSyncable>(
    repository: Repository<T>,
    agency: AgencyEntity,
    items: T[],
    toProperties: (entity: T) => NotionProperties,
    isCalendarEligible?: (entity: T) => boolean,
    toBody?: (entity: T) => string | null,
  ): Promise<SyncSummary> {
    const databaseId = await this.resolveDatabaseId(repository, agency);
    const token = await this.notionOAuth.getRuntimeToken(agency.id);
    const client = this.notionClient.getClient(token);
    const summary = emptySummary();

    for (const item of items) {
      try {
        if (isCalendarEligible && !isCalendarEligible(item)) {
          await this.archiveIfSynced(client, item, repository, summary);
          continue;
        }

        const properties = toProperties(item);
        const body = toBody?.(item) ?? null;
        const existingPageId = item.notionPageId;

        const page = existingPageId
          ? await client.updatePage(existingPageId, properties)
          : await client.createPage(databaseId, properties, body);

        // La creation embarque directement le markdown ; la mise a jour des
        // proprietes ne touche pas au corps de la page, d'ou cet appel a part.
        if (existingPageId && body) {
          await client.setPageContent(existingPageId, body);
        }

        if (existingPageId) {
          summary.updated += 1;
        } else {
          summary.created += 1;
        }

        this.markSynced(item, page);
        await repository.save(item);
      } catch (error) {
        if (error instanceof NotionApiError && error.kind === 'UNAUTHORIZED') {
          // Le token est invalide/revoque : retenter les items suivants avec
          // le meme client echouerait de la meme facon, inutile d'insister.
          summary.errors += 1;
          item.syncStatus = SyncStatus.ERROR;
          await repository.save(item);
          this.logger.error(
            `Notion push interrompu pour l'agence ${agency.id} (${repository.metadata.name}) : token invalide ou revoque, reconnexion Notion necessaire.`,
          );
          break;
        }

        if (
          error instanceof NotionApiError &&
          error.kind === 'NOT_FOUND' &&
          item.notionPageId
        ) {
          // La page pointee n'existe plus cote Notion (supprimee a la main) :
          // on oublie le pointeur pour qu'un prochain push en recree une
          // plutot que de rester bloque en erreur indefiniment.
          item.notionPageId = null;
          item.notionLastEditedAt = null;
          item.syncStatus = SyncStatus.PENDING;
          await repository.save(item);
          summary.skipped += 1;
          this.logger.warn(
            `Page Notion introuvable pour ${repository.metadata.name} ${item.id} : sera recreee au prochain push.`,
          );
          continue;
        }

        summary.errors += 1;
        item.syncStatus = SyncStatus.ERROR;
        await repository.save(item);
        this.logger.error(
          `Push failed for ${repository.metadata.name} ${item.id}: ${String(error)}`,
        );
      }
    }

    return summary;
  }

  /**
   * Un contenu qui n'est plus eligible au calendrier (ex: retour a DRAFT)
   * perd sa page Notion : archivee si elle existe, sinon rien a faire (il
   * n'a jamais ete pousse).
   */
  private async archiveIfSynced<T extends NotionSyncable>(
    client: NotionClientPort,
    item: T,
    repository: Repository<T>,
    summary: SyncSummary,
  ): Promise<void> {
    if (!item.notionPageId) {
      item.syncStatus = SyncStatus.SYNCED;
      await repository.save(item);
      summary.skipped += 1;
      return;
    }

    try {
      await client.archivePage(item.notionPageId);
    } catch (error) {
      if (!(error instanceof NotionApiError && error.kind === 'NOT_FOUND')) {
        throw error;
      }
      // Deja supprimee/archivee cote Notion : rien a faire de plus, on
      // considere l'archivage comme reussi.
    }

    item.notionPageId = null;
    item.notionLastEditedAt = null;
    item.lastSyncedAt = new Date();
    item.syncStatus = SyncStatus.SYNCED;
    await repository.save(item);
    summary.updated += 1;
  }

  private async pullItems<T extends NotionSyncable>(
    repository: Repository<T>,
    agency: AgencyEntity,
    applyPage: (entity: T, page: NotionPage) => void,
    createEntity: () => T,
  ): Promise<SyncSummary> {
    const databaseId = await this.resolveDatabaseId(repository, agency);
    const token = await this.notionOAuth.getRuntimeToken(agency.id);
    const client = this.notionClient.getClient(token);
    const summary = emptySummary();

    let pages: NotionPage[];
    try {
      pages = await this.fetchAllPages(client, databaseId);
    } catch (error) {
      const reason =
        error instanceof NotionApiError && error.kind === 'UNAUTHORIZED'
          ? 'token invalide ou revoque, reconnexion Notion necessaire'
          : String(error);
      this.logger.error(
        `Pull impossible pour ${repository.metadata.name} (agence ${agency.id}) : ${reason}`,
      );
      summary.errors += 1;
      return summary;
    }

    for (const page of pages) {
      try {
        const existing = await repository.findOne({
          where: { notionPageId: page.id } as never,
        });
        const outcome = existing
          ? this.applyRemoteUpdate(existing, page, applyPage)
          : this.applyRemoteCreation(createEntity(), page, applyPage);

        if (outcome === 'skipped') {
          summary.skipped += 1;
          continue;
        }

        await repository.save(outcome.entity);
        summary[outcome.kind] += 1;
      } catch (error) {
        summary.errors += 1;
        this.logger.error(
          `Pull failed for ${repository.metadata.name} page ${page.id}: ${String(error)}`,
        );
      }
    }

    return summary;
  }

  private applyRemoteCreation<T extends NotionSyncable>(
    entity: T,
    page: NotionPage,
    applyPage: (entity: T, page: NotionPage) => void,
  ): { kind: 'created'; entity: T } {
    applyPage(entity, page);
    entity.notionPageId = page.id;
    entity.notionLastEditedAt = new Date(page.last_edited_time);
    entity.lastSyncedAt = new Date();
    entity.syncStatus = SyncStatus.SYNCED;

    return { kind: 'created', entity };
  }

  private applyRemoteUpdate<T extends NotionSyncable>(
    entity: T,
    page: NotionPage,
    applyPage: (entity: T, page: NotionPage) => void,
  ): { kind: 'updated'; entity: T } | 'skipped' {
    const pageEditedAt = new Date(page.last_edited_time);

    // Rien de neuf cote Notion depuis la derniere sync : on ignore.
    if (
      entity.notionLastEditedAt &&
      pageEditedAt <= entity.notionLastEditedAt
    ) {
      return 'skipped';
    }

    // L'application a-t-elle change depuis la derniere sync ? Si oui ET Notion
    // aussi, les deux cotes divergent : conflit (resolu en faveur de Notion).
    const changedInApp =
      !!entity.lastSyncedAt && entity.updatedAt > entity.lastSyncedAt;

    applyPage(entity, page);
    entity.notionPageId = page.id;
    entity.notionLastEditedAt = pageEditedAt;
    entity.lastSyncedAt = new Date();
    entity.syncStatus = changedInApp ? SyncStatus.CONFLICT : SyncStatus.SYNCED;

    return { kind: 'updated', entity };
  }

  private markSynced(entity: NotionSyncable, page: NotionPage): void {
    entity.notionPageId = page.id;
    entity.notionLastEditedAt = new Date(page.last_edited_time);
    entity.lastSyncedAt = new Date();
    entity.syncStatus = SyncStatus.SYNCED;
  }

  private async fetchAllPages(
    client: NotionClientPort,
    databaseId: string,
  ): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const result = await client.queryDatabase({
        databaseId,
        startCursor: cursor,
      });
      pages.push(...result.pages);
      cursor = result.hasMore ? (result.nextCursor ?? undefined) : undefined;
    } while (cursor);

    return pages;
  }

  /**
   * Determine la base Notion cible, par ordre de priorite :
   * 1. Auto-detectee dans l'espace connecte de l'agence (cf. `NotionOAuthService.resolveDatabaseId`) —
   *    chaque agence pointe ainsi vers ses propres bases, meme si elle a
   *    duplique le template dans son propre workspace.
   * 2. Override legacy `agency.notionDatabaseId` (contenu uniquement, garde
   *    pour compatibilite).
   * 3. Variable d'environnement globale (utile en single-tenant/demo).
   */
  private async resolveDatabaseId<T extends NotionSyncable>(
    repository: Repository<T>,
    agency: AgencyEntity,
  ): Promise<string> {
    const isContent = repository.metadata.name === ContentItemEntity.name;
    const target = isContent ? 'content' : 'curation';

    const discovered = await this.notionOAuth.resolveDatabaseId(
      agency.id,
      target,
    );
    const legacy = isContent ? agency.notionDatabaseId : null;
    const envFallback = isContent
      ? this.config.get<string>('NOTION_CONTENT_DATABASE_ID')
      : this.config.get<string>('NOTION_CURATION_DATABASE_ID');

    const databaseId = discovered ?? legacy ?? envFallback;

    if (!databaseId) {
      throw new Error(
        `Notion database id is not configured for ${repository.metadata.name}.`,
      );
    }

    return databaseId;
  }
}
