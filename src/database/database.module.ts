import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const useSsl = configService.get<string>('DB_SSL') === 'true';

        const baseOptions: TypeOrmModuleOptions = {
          type: 'postgres',
          autoLoadEntities: true,
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
          ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
        };

        if (databaseUrl) {
          return {
            ...baseOptions,
            url: databaseUrl,
          };
        }

        return {
          ...baseOptions,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: Number(configService.get<string>('DB_PORT') ?? 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'seo_genius'),
        };
      },
    }),
  ],
})
export class DatabaseModule {}
