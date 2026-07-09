import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { NotionSyncService } from './notion-sync.service';

/**
 * Synchronisation periodique Notion <-> application.
 *
 * Desactivee par defaut (NOTION_SYNC_ENABLED != 'true') pour ne jamais tourner
 * en test/CI. La cadence est pilotee par NOTION_SYNC_CRON.
 */
@Injectable()
export class NotionSyncScheduler {
  private readonly logger = new Logger(NotionSyncScheduler.name);

  constructor(
    private readonly notionSync: NotionSyncService,
    private readonly config: ConfigService,
    @InjectRepository(AgencyEntity)
    private readonly agenciesRepository: Repository<AgencyEntity>,
  ) {}

  @Cron(process.env.NOTION_SYNC_CRON ?? '*/5 * * * *')
  async handleSync(): Promise<void> {
    if (this.config.get<string>('NOTION_SYNC_ENABLED') !== 'true') {
      return;
    }

    const agencies = await this.agenciesRepository.find();

    for (const agency of agencies) {
      try {
        // Notion fait foi en premier (pull), puis on pousse les nouveautes.
        await this.notionSync.pullAll(agency);
        await this.notionSync.pushAll(agency);
      } catch (error) {
        this.logger.error(
          `Scheduled sync failed for agency ${agency.id}: ${String(error)}`,
        );
      }
    }
  }
}
