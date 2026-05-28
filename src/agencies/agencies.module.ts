import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserEntity } from '../users/user.entity';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { AgencyEntity } from './entities/agency.entity';
import { AgencyInvitationEntity } from './entities/agency-invitation.entity';
import { AgencyMembershipEntity } from './entities/agency-membership.entity';
import { AgencyRolesGuard } from './guards/agency-roles.guard';
import { MembersController } from './members.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AgencyEntity,
      AgencyInvitationEntity,
      AgencyMembershipEntity,
      UserEntity,
    ]),
  ],
  controllers: [AgenciesController, MembersController],
  providers: [AgenciesService, AgencyRolesGuard],
  exports: [AgenciesService, AgencyRolesGuard],
})
export class AgenciesModule {}
