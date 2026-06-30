import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { AgenciesService } from './agencies.service';
import { AgencyRoles } from './decorators/agency-roles.decorator';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { AgencyRolesGuard } from './guards/agency-roles.guard';

@Controller('members')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class MembersController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Patch(':id/role')
  @AgencyRoles(AgencyRole.OWNER, { membershipIdParam: 'id' })
  updateMemberRole(
    @Param('id') membershipId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    return this.agenciesService.updateMemberRole(membershipId, body);
  }
}
