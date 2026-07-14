import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { AgencyRoles } from '../agencies/decorators/agency-roles.decorator';
import { AgencyRolesGuard } from '../agencies/guards/agency-roles.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AiService } from './ai.service';

@Controller('agencies/:agencyId/ai/models')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class AiModelsController {
  constructor(private readonly aiService: AiService) {}

  @Get()
  @AgencyRoles(AgencyRole.OWNER, { agencyIdSource: 'params' })
  listModels(
    @Param('agencyId') agencyId: string,
    @Query('provider') provider?: string,
  ) {
    return this.aiService.listModelsForAgency(agencyId, provider);
  }
}
