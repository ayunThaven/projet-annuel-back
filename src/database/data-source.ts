import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { AgencyInvitationEntity } from '../agencies/entities/agency-invitation.entity';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { UserEntity } from '../users/user.entity';
import { InitAuthAgencies1782864000000 } from './migrations/1782864000000-init-auth-agencies';

config({ quiet: true });

const useSsl = process.env.DB_SSL === 'true';
const databaseUrl = process.env.DATABASE_URL;

const baseOptions: DataSourceOptions = {
  type: 'postgres',
  entities: [
    AgencyEntity,
    AgencyInvitationEntity,
    AgencyMembershipEntity,
    UserEntity,
  ],
  migrations: [InitAuthAgencies1782864000000],
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
