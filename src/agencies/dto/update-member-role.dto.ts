import { IsEnum } from 'class-validator';
import { AgencyRole } from '../../common/enums/agency-role.enum';

export class UpdateMemberRoleDto {
  @IsEnum(AgencyRole)
  role: AgencyRole;
}
