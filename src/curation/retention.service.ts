import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { SyncStatus } from '../common/enums/sync-status.enum';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { CurationItemEntity } from './entities/curation-item.entity';

const DEFAULT_RETENTION_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface RetentionSummary {
  content: number;
  curation: number;
}

/**
 * Purge de retention : supprime de l'application les ressources plus anciennes
 * que RETENTION_DAYS (30 par defaut) et deja archivees dans Notion (SYNCED).
 *
 * Les elements PENDING ou ERROR sont conserves meme au-dela du delai, afin de
 * ne jamais perdre une donnee non archivee.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectRepository(ContentItemEntity)
    private readonly contentRepository: Repository<ContentItemEntity>,
    @InjectRepository(CurationItemEntity)
    private readonly curationRepository: Repository<CurationItemEntity>,
    private readonly configService: ConfigService,
  ) {}

  private get retentionDays(): number {
    const raw = this.configService.get<string | number>('RETENTION_DAYS');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_RETENTION_DAYS;
  }

  async purgeExpired(): Promise<RetentionSummary> {
    const cutoff = new Date(Date.now() - this.retentionDays * DAY_IN_MS);
    const where = {
      createdAt: LessThan(cutoff),
      syncStatus: SyncStatus.SYNCED,
    };

    const content = await this.contentRepository.delete(where);
    const curation = await this.curationRepository.delete(where);

    const summary: RetentionSummary = {
      content: content.affected ?? 0,
      curation: curation.affected ?? 0,
    };

    this.logger.log(
      `Retention: ${summary.content} contenus et ${summary.curation} ressources purges (cutoff ${cutoff.toISOString()})`,
    );

    return summary;
  }
}
