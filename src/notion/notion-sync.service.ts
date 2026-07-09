import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { SyncStatus } from '../common/enums/sync-status.enum';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { CurationItemEntity } from '../curation/entities/curation-item.entity';
import * as contentMapper from './mappers/content.mapper';
import * as curationMapper from './mappers/curation.mapper';
import { NotionClientService } from './notion-client.service';
import { NotionSyncable } from './notion-syncable';
import { NotionClientPort, NotionPage, NotionProperties } from './notion.types';

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

  async pushContent(agency: AgencyEntity): Promise<SyncSummary> {
    return this.pushItems(this.contentRepository, agency, (entity) =>
      contentMapper.toNotionProperties(entity),
    );
  }

  async pushCuration(agency: AgencyEntity): Promise<SyncSummary> {
    return this.pushItems(this.curationRepository, agency, (entity) =>
      curationMapper.toNotionProperties(entity),
    );
  }

  async pullContent(agency: AgencyEntity): Promise<SyncSummary> {
    return this.pullItems(
      this.contentRepository,
      agency,
      (entity, page) =>
        Object.assign(entity, contentMapper.fromNotionPage(page)),
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

  private async pushItems<T extends NotionSyncable>(
    repository: Repository<T>,
    agency: AgencyEntity,
    toProperties: (entity: T) => NotionProperties,
  ): Promise<SyncSummary> {
    const databaseId = this.resolveDatabaseId(repository, agency);
    const client = this.notionClient.getClient();
    const summary = emptySummary();

    const items = await repository.find({
      where: {
        syncStatus: In([SyncStatus.PENDING, SyncStatus.ERROR]),
      } as never,
    });

    for (const item of items) {
      try {
        const properties = toProperties(item);
        const page = item.notionPageId
          ? await client.updatePage(item.notionPageId, properties)
          : await client.createPage(databaseId, properties);

        if (item.notionPageId) {
          summary.updated += 1;
        } else {
          summary.created += 1;
        }

        this.markSynced(item, page);
        await repository.save(item);
      } catch (error) {
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

  private async pullItems<T extends NotionSyncable>(
    repository: Repository<T>,
    agency: AgencyEntity,
    applyPage: (entity: T, page: NotionPage) => void,
    createEntity: () => T,
  ): Promise<SyncSummary> {
    const databaseId = this.resolveDatabaseId(repository, agency);
    const client = this.notionClient.getClient();
    const summary = emptySummary();

    for (const page of await this.fetchAllPages(client, databaseId)) {
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

  private resolveDatabaseId<T extends NotionSyncable>(
    repository: Repository<T>,
    agency: AgencyEntity,
  ): string {
    const isContent = repository.metadata.name === ContentItemEntity.name;
    const databaseId = isContent
      ? (agency.notionDatabaseId ??
        this.config.get<string>('NOTION_CONTENT_DATABASE_ID'))
      : this.config.get<string>('NOTION_CURATION_DATABASE_ID');

    if (!databaseId) {
      throw new Error(
        `Notion database id is not configured for ${repository.metadata.name}.`,
      );
    }

    return databaseId;
  }
}
