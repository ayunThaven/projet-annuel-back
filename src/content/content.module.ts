import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciesModule } from '../agencies/agencies.module';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { AuthModule } from '../auth/auth.module';
import { UserEntity } from '../users/user.entity';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ContentItemEntity } from './entities/content-item.entity';

@Module({
  imports: [
    AuthModule,
    AgenciesModule,
    TypeOrmModule.forFeature([
      ContentItemEntity,
      // Repos requis par les guards instancies dans ce module.
      AgencyMembershipEntity,
      UserEntity,
    ]),
  ],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
