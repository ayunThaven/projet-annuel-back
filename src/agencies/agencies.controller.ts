import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { AgenciesService } from './agencies.service';
import { AgencyRoles } from './decorators/agency-roles.decorator';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { AgencyRolesGuard } from './guards/agency-roles.guard';

@Controller('agencies')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Post()
  createAgency(@Req() req: AuthenticatedRequest, @Body() body: CreateAgencyDto) {
    return this.agenciesService.createAgency(req.user.sub, body);
  }

  @Get()
  listAgencies(@Req() req: AuthenticatedRequest) {
    return this.agenciesService.listAgencies(req.user.sub);
  }

  @Get('current')
  getCurrentAgency(@Req() req: AuthenticatedRequest) {
    return this.agenciesService.getCurrentAgency(req.user.sub);
  }

  @Get(':agencyId/members')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, AgencyRole.VIEWER, {
    agencyIdSource: 'params',
  })
  listMembers(@Param('agencyId') agencyId: string) {
    return this.agenciesService.listAgencyMembers(agencyId);
  }

  @Patch(':agencyId')
  @AgencyRoles(AgencyRole.OWNER, { agencyIdSource: 'params' })
  updateAgency(
    @Param('agencyId') agencyId: string,
    @Body() body: UpdateAgencyDto,
  ) {
    return this.agenciesService.updateAgency(agencyId, body);
  }

  @Post('invitations')
  @AgencyRoles(AgencyRole.OWNER)
  inviteMember(@Req() req: AuthenticatedRequest, @Body() body: InviteMemberDto) {
    return this.agenciesService.inviteMember(req.user.sub, body);
  }

  @Post('invitations/:token/accept')
  acceptInvitation(
    @Req() req: AuthenticatedRequest,
    @Param('token') token: string,
  ) {
    return this.agenciesService.acceptInvitation(req.user.sub, token);
  }
}
