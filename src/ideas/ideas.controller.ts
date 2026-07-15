import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AgencyRoles } from '../agencies/decorators/agency-roles.decorator';
import { AgencyRolesGuard } from '../agencies/guards/agency-roles.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { GenerateContentIdeasDto } from './dto/generate-content-ideas.dto';
import { UpdateContentIdeaDto } from './dto/update-content-idea.dto';
import { UpdateIdeaGenerationSettingsDto } from './dto/update-idea-generation-settings.dto';
import { IdeasScheduler } from './ideas.scheduler';
import { IdeasService } from './ideas.service';

@Controller('agencies/:agencyId/ideas')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class IdeasController {
  constructor(
    private readonly ideasService: IdeasService,
    private readonly ideasScheduler: IdeasScheduler,
  ) {}

  @Get()
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, AgencyRole.VIEWER, {
    agencyIdSource: 'params',
  })
  findAll(@Param('agencyId') agencyId: string) {
    return this.ideasService.findAll(agencyId);
  }

  @Post('generate')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  generate(
    @Param('agencyId') agencyId: string,
    @Body() body: GenerateContentIdeasDto,
  ) {
    return this.ideasService.generate(agencyId, body);
  }

  @Get('settings')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, AgencyRole.VIEWER, {
    agencyIdSource: 'params',
  })
  getSettings(@Param('agencyId') agencyId: string) {
    return this.ideasService.getSettings(agencyId);
  }

  @Patch('settings')
  @AgencyRoles(AgencyRole.OWNER, {
    agencyIdSource: 'params',
  })
  async updateSettings(
    @Param('agencyId') agencyId: string,
    @Body() body: UpdateIdeaGenerationSettingsDto,
  ) {
    const settings = await this.ideasService.updateSettings(agencyId, body);
    await this.ideasScheduler.syncAgencySchedule(agencyId);

    return settings;
  }

  @Patch(':id')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  update(
    @Param('agencyId') agencyId: string,
    @Param('id') id: string,
    @Body() body: UpdateContentIdeaDto,
  ) {
    return this.ideasService.update(agencyId, id, body);
  }

  @Post(':id/accept')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  accept(@Param('agencyId') agencyId: string, @Param('id') id: string) {
    return this.ideasService.accept(agencyId, id);
  }
}
