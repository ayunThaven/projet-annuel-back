import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserEntity } from '../users/user.entity';
import { AgenciesModule } from '../agencies/agencies.module';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { AiController } from './ai.controller';
import { AiModelsController } from './ai-models.controller';
import { AiService } from './ai.service';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { AgencyAiSettingsEntity } from './entities/agency-ai-settings.entity';
import { DemoAiProvider } from './providers/demo-ai.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  imports: [
    AuthModule,
    AgenciesModule,
    TypeOrmModule.forFeature([
      UserEntity,
      AgencyMembershipEntity,
      AgencyAiSettingsEntity,
    ]),
  ],
  controllers: [AiController, AiSettingsController, AiModelsController],
  providers: [AiService, AiSettingsService, DemoAiProvider, GeminiProvider],
  exports: [AiService, AiSettingsService],
})
export class AiModule {}
