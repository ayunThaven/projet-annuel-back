import { Client } from '@notionhq/client';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciesModule } from '../agencies/agencies.module';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { AuthModule } from '../auth/auth.module';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { CurationItemEntity } from '../curation/entities/curation-item.entity';
import { UserEntity } from '../users/user.entity';
import { NotionClientService } from './notion-client.service';
import { NotionController } from './notion.controller';
import { NOTION_CLIENT_FACTORY } from './notion.constants';
import { NotionSyncScheduler } from './notion-sync.scheduler';
import { NotionSyncService } from './notion-sync.service';
import { NotionClientFactory } from './notion.types';
import { SdkNotionClient } from './sdk-notion-client';

/**
 * Fabrique de client Notion par defaut : chaque token donne un client SDK reel.
 * Surchargee par un fake dans les tests via le token NOTION_CLIENT_FACTORY.
 */
const notionClientFactory: NotionClientFactory = (auth: string) =>
  new SdkNotionClient(new Client({ auth }));

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    AgenciesModule,
    TypeOrmModule.forFeature([
      ContentItemEntity,
      CurationItemEntity,
      AgencyEntity,
      // Repos requis par les guards (AuthGuard, AgencyRolesGuard) instancies
      // dans le contexte de ce module.
      AgencyMembershipEntity,
      UserEntity,
    ]),
  ],
  controllers: [NotionController],
  providers: [
    { provide: NOTION_CLIENT_FACTORY, useValue: notionClientFactory },
    NotionClientService,
    NotionSyncService,
    NotionSyncScheduler,
  ],
  exports: [NotionSyncService, NotionClientService],
})
export class NotionModule {}
