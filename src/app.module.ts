import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AgenciesModule } from './agencies/agencies.module';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { ContentModule } from './content/content.module';
import { CurationModule } from './curation/curation.module';
import { NotionModule } from './notion/notion.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    AgenciesModule,
    AiModule,
    ContentModule,
    CurationModule,
    NotionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
