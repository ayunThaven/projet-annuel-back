import { IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AgencyRole } from '../../common/enums/agency-role.enum';

export class InviteMemberDto {
  @IsUUID()
  agencyId: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(AgencyRole)
  role?: AgencyRole;
}
