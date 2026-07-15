import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { ContentStatus } from '../common/enums/content-status.enum';
import { SyncStatus } from '../common/enums/sync-status.enum';
import { CALENDAR_ELIGIBLE_STATUSES } from '../notion/mappers/content.mapper';
import { NotionSyncService } from '../notion/notion-sync.service';
import { CreateContentItemDto } from './dto/create-content-item.dto';
import { UpdateContentItemDto } from './dto/update-content-item.dto';
import { ContentItemEntity } from './entities/content-item.entity';

/**
 * CRUD des contenus editoriaux d'une agence.
 *
 * Toute creation ou modification repasse l'element en `PENDING` : c'est ce qui
 * declenchera son export vers Notion au prochain `push`. Quand le statut
 * planifie/publie est concerne, un push immediat est aussi declenche (sans
 * attendre le cron, desactive par defaut).
 */
@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @InjectRepository(ContentItemEntity)
    private readonly contentRepository: Repository<ContentItemEntity>,
    @InjectRepository(AgencyEntity)
    private readonly agenciesRepository: Repository<AgencyEntity>,
    private readonly notionSync: NotionSyncService,
  ) {}

  async create(agencyId: string, input: CreateContentItemDto) {
    const item = this.contentRepository.create({
      agency: { id: agencyId } as AgencyEntity,
      title: input.title.trim(),
      status: input.status,
      publicationDate: input.publicationDate
        ? new Date(input.publicationDate)
        : null,
      channel: input.channel ?? null,
      contentType: input.contentType ?? null,
      url: input.url ?? null,
      tags: input.tags ?? null,
      notes: input.notes ?? null,
      syncStatus: SyncStatus.PENDING,
    });

    const saved = await this.contentRepository.save(item);

    if (this.isCalendarEligible(saved.status)) {
      void this.syncToNotion(agencyId);
    }

    return saved;
  }

  findAll(agencyId: string) {
    return this.contentRepository.find({
      where: { agency: { id: agencyId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(agencyId: string, id: string) {
    const item = await this.contentRepository.findOne({
      where: { id, agency: { id: agencyId } },
    });

    if (!item) {
      throw new NotFoundException('Content item not found');
    }

    return item;
  }

  async update(agencyId: string, id: string, input: UpdateContentItemDto) {
    const item = await this.findOne(agencyId, id);
    const previousStatus = item.status;

    if (input.title !== undefined) item.title = input.title.trim();
    if (input.status !== undefined) item.status = input.status;
    if (input.publicationDate !== undefined) {
      item.publicationDate = input.publicationDate
        ? new Date(input.publicationDate)
        : null;
    }
    if (input.channel !== undefined) item.channel = input.channel;
    if (input.contentType !== undefined) item.contentType = input.contentType;
    if (input.url !== undefined) item.url = input.url;
    if (input.tags !== undefined) item.tags = input.tags;
    if (input.notes !== undefined) item.notes = input.notes;
    if (input.body !== undefined) item.body = input.body;

    // Modifie cote application : a re-exporter vers Notion.
    item.syncStatus = SyncStatus.PENDING;

    const saved = await this.contentRepository.save(item);

    if (
      this.isCalendarEligible(previousStatus) ||
      this.isCalendarEligible(saved.status)
    ) {
      void this.syncToNotion(agencyId);
    }

    return saved;
  }

  async remove(agencyId: string, id: string) {
    const item = await this.findOne(agencyId, id);
    await this.contentRepository.remove(item);

    return { success: true };
  }

  private isCalendarEligible(status: ContentStatus): boolean {
    return CALENDAR_ELIGIBLE_STATUSES.includes(status);
  }

  /**
   * Pousse immediatement les contenus eligibles au calendrier vers Notion.
   * Ne bloque jamais la reponse HTTP : toute erreur (Notion non connecte,
   * token invalide...) est journalisee et laissee au `syncStatus = ERROR`
   * pour un rattrapage ulterieur (cron ou push manuel).
   */
  private async syncToNotion(agencyId: string): Promise<void> {
    const agency = await this.agenciesRepository.findOne({
      where: { id: agencyId },
    });

    if (!agency) {
      return;
    }

    try {
      await this.notionSync.pushContent(agency);
    } catch (error) {
      this.logger.error(
        `Notion push failed for agency ${agencyId}: ${String(error)}`,
      );
    }
  }
}
