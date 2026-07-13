import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciesModule } from '../agencies/agencies.module';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { ContentModule } from '../content/content.module';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { CurationItemEntity } from '../curation/entities/curation-item.entity';
import { UserEntity } from '../users/user.entity';
import { ContentIdeaEntity } from './entities/content-idea.entity';
import { IdeaGenerationRunEntity } from './entities/idea-generation-run.entity';
import { IdeaGenerationSettingsEntity } from './entities/idea-generation-settings.entity';
import { IdeasController } from './ideas.controller';
import { IdeasScheduler } from './ideas.scheduler';
import { IdeasService } from './ideas.service';

@Module({
  imports: [
    AuthModule,
    AgenciesModule,
    AiModule,
    ContentModule,
    TypeOrmModule.forFeature([
      ContentIdeaEntity,
      IdeaGenerationSettingsEntity,
      IdeaGenerationRunEntity,
      ContentItemEntity,
      CurationItemEntity,
      AgencyEntity,
      AgencyMembershipEntity,
      UserEntity,
    ]),
  ],
  controllers: [IdeasController],
  providers: [IdeasService, IdeasScheduler],
  exports: [IdeasService],
})
export class IdeasModule {}
