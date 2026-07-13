import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciesModule } from '../agencies/agencies.module';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { AuthModule } from '../auth/auth.module';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { UserEntity } from '../users/user.entity';
import { CurationController } from './curation.controller';
import { CurationSchedulerService } from './curation-scheduler.service';
import { CurationService } from './curation.service';
import { CurationItemEntity } from './entities/curation-item.entity';
import { FeedSourceEntity } from './entities/feed-source.entity';
import { FeedSourceController } from './feed-source.controller';
import { FeedSourceService } from './feed-source.service';
import { RetentionService } from './retention.service';
import { RssIngestionService } from './rss-ingestion.service';
import { rssParser } from './rss-parser.factory';
import { RSS_PARSER } from './rss.types';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    AgenciesModule,
    TypeOrmModule.forFeature([
      CurationItemEntity,
      FeedSourceEntity,
      // ContentItemEntity + AgencyEntity : requis par la retention et le scheduler.
      ContentItemEntity,
      AgencyEntity,
      // Repos requis par les guards instancies dans ce module.
      AgencyMembershipEntity,
      UserEntity,
    ]),
  ],
  controllers: [CurationController, FeedSourceController],
  providers: [
    CurationService,
    FeedSourceService,
    RssIngestionService,
    RetentionService,
    CurationSchedulerService,
    {
      provide: RSS_PARSER,
      useValue: rssParser,
    },
  ],
  exports: [CurationService, RssIngestionService, RetentionService],
})
export class CurationModule {}
