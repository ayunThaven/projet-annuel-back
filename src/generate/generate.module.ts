import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciesModule } from '../agencies/agencies.module';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { UserEntity } from '../users/user.entity';
import { GenerateController } from './generate.controller';
import { GenerateService } from './generate.service';

@Module({
  imports: [
    AuthModule,
    AgenciesModule,
    AiModule,
    TypeOrmModule.forFeature([
      ContentItemEntity,
      AgencyMembershipEntity,
      UserEntity,
    ]),
  ],
  controllers: [GenerateController],
  providers: [GenerateService],
})
export class GenerateModule {}