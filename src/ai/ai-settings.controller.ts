import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { AgencyRoles } from '../agencies/decorators/agency-roles.decorator';
import { AgencyRolesGuard } from '../agencies/guards/agency-roles.guard';
import { AuthGuard } from '../auth/auth.guard';
import { UpdateAgencyAiSettingsDto } from './dto/update-agency-ai-settings.dto';
import { AiSettingsService } from './ai-settings.service';

@Controller('agencies/:agencyId/ai/settings')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  @Get()
  @AgencyRoles(AgencyRole.OWNER, { agencyIdSource: 'params' })
  getSettings(@Param('agencyId') agencyId: string) {
    return this.aiSettingsService.getPublicSettings(agencyId);
  }

  @Patch()
  @AgencyRoles(AgencyRole.OWNER, { agencyIdSource: 'params' })
  updateSettings(
    @Param('agencyId') agencyId: string,
    @Body() body: UpdateAgencyAiSettingsDto,
  ) {
    return this.aiSettingsService.updateSettings(agencyId, body);
  }
}
