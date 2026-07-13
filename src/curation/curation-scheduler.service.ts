import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { RetentionService } from './retention.service';
import { RssIngestionService } from './rss-ingestion.service';

/**
 * Taches planifiees de la curation :
 * - ingestion horaire des flux RSS (si RSS_CRON_ENABLED=true),
 * - purge quotidienne de retention (30 jours).
 *
 * Les crons restent enregistres mais leur corps est court-circuite quand la
 * fonctionnalite est desactivee par configuration.
 */
@Injectable()
export class CurationSchedulerService {
  private readonly logger = new Logger(CurationSchedulerService.name);

  constructor(
    @InjectRepository(AgencyEntity)
    private readonly agenciesRepository: Repository<AgencyEntity>,
    private readonly rssIngestionService: RssIngestionService,
    private readonly retentionService: RetentionService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async ingestAllFeeds(): Promise<void> {
    if (this.configService.get<string>('RSS_CRON_ENABLED') !== 'true') {
      return;
    }

    const agencies = await this.agenciesRepository.find();

    for (const agency of agencies) {
      try {
        const summary = await this.rssIngestionService.ingestAllForAgency(
          agency.id,
        );
        this.logger.log(
          `RSS ${agency.id}: ${summary.imported} importes, ${summary.skipped} ignores`,
        );
      } catch (error) {
        this.logger.error(
          `Ingestion RSS planifiee echouee pour ${agency.id}`,
          error as Error,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runRetention(): Promise<void> {
    try {
      await this.retentionService.purgeExpired();
    } catch (error) {
      this.logger.error('Purge de retention planifiee echouee', error as Error);
    }
  }
}
