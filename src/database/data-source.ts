import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { AgencyInvitationEntity } from '../agencies/entities/agency-invitation.entity';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { CurationItemEntity } from '../curation/entities/curation-item.entity';
import { ContentIdeaEntity } from '../ideas/entities/content-idea.entity';
import { IdeaGenerationRunEntity } from '../ideas/entities/idea-generation-run.entity';
import { IdeaGenerationSettingsEntity } from '../ideas/entities/idea-generation-settings.entity';
import { UserEntity } from '../users/user.entity';
import { InitAuthAgencies1782864000000 } from './migrations/1782864000000-init-auth-agencies';
import { NotionContentCuration1782950400000 } from './migrations/1782950400000-notion-content-curation';
import { IdeasGeneration1783036800000 } from './migrations/1783036800000-ideas-generation';
import { IdeaGenerationDailyDefault1783123200000 } from './migrations/1783123200000-idea-generation-daily-default';
import { FeedSourceEntity } from '../curation/entities/feed-source.entity';
import { FeedSources1782960000000 } from './migrations/1782960000000-feed-sources';
import { AddContentBody1783900800000 } from './migrations/1783900800000-add-content-body';
import { AgencyAiSettingsEntity } from '../ai/entities/agency-ai-settings.entity';
import { AgencyAiSettings1783987200000 } from './migrations/1783987200000-agency-ai-settings';

config({ quiet: true });

const useSsl = process.env.DB_SSL === 'true';
const databaseUrl = process.env.DATABASE_URL;

const baseOptions: DataSourceOptions = {
  type: 'postgres',
  entities: [
    AgencyEntity,
    AgencyInvitationEntity,
    AgencyMembershipEntity,
    ContentItemEntity,
    CurationItemEntity,
    ContentIdeaEntity,
    IdeaGenerationSettingsEntity,
    IdeaGenerationRunEntity,
    FeedSourceEntity,
    AgencyAiSettingsEntity,
    UserEntity,
  ],
  migrations: [
    InitAuthAgencies1782864000000,
    NotionContentCuration1782950400000,
    IdeasGeneration1783036800000,
    IdeaGenerationDailyDefault1783123200000,
    FeedSources1782960000000,
    AddContentBody1783900800000,
    AgencyAiSettings1783987200000,
  ],
  synchronize: false,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
};

export const dataSourceOptions: DataSourceOptions = databaseUrl
  ? {
      ...baseOptions,
      url: databaseUrl,
    }
  : {
      ...baseOptions,
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'seo_genius',
    };

export default new DataSource(dataSourceOptions);
