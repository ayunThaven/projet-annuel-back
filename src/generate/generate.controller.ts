import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AgencyRoles } from '../agencies/decorators/agency-roles.decorator';
import { AgencyRolesGuard } from '../agencies/guards/agency-roles.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { GenerateContentDto } from './dto/generate-content.dto';
import { GenerateService } from './generate.service';

@Controller('agencies/:agencyId/content')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class GenerateController {
  constructor(private readonly generateService: GenerateService) {}

  @Post('generate')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  generateContent(
    @Param('agencyId') agencyId: string,
    @Body() body: GenerateContentDto,
  ) {
    return this.generateService.generateContent(agencyId, body);
  }
}