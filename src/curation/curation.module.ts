import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciesModule } from '../agencies/agencies.module';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { AuthModule } from '../auth/auth.module';
import { UserEntity } from '../users/user.entity';
import { CurationController } from './curation.controller';
import { CurationService } from './curation.service';
import { CurationItemEntity } from './entities/curation-item.entity';

@Module({
  imports: [
    AuthModule,
    AgenciesModule,
    TypeOrmModule.forFeature([
      CurationItemEntity,
      // Repos requis par les guards instancies dans ce module.
      AgencyMembershipEntity,
      UserEntity,
    ]),
  ],
  controllers: [CurationController],
  providers: [CurationService],
  exports: [CurationService],
})
export class CurationModule {}
