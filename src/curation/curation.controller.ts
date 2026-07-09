import {
  Body,
  Controller,
  Delete,
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
import { CurationService } from './curation.service';
import { CreateCurationItemDto } from './dto/create-curation-item.dto';
import { UpdateCurationItemDto } from './dto/update-curation-item.dto';

/**
 * CRUD des ressources curees, scope a une agence.
 * Lecture ouverte aux 3 roles ; ecriture reservee OWNER/EDITOR.
 */
@Controller('agencies/:agencyId/curation')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class CurationController {
  constructor(private readonly curationService: CurationService) {}

  @Post()
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  create(
    @Param('agencyId') agencyId: string,
    @Body() body: CreateCurationItemDto,
  ) {
    return this.curationService.create(agencyId, body);
  }

  @Get()
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, AgencyRole.VIEWER, {
    agencyIdSource: 'params',
  })
  findAll(@Param('agencyId') agencyId: string) {
    return this.curationService.findAll(agencyId);
  }

  @Get(':id')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, AgencyRole.VIEWER, {
    agencyIdSource: 'params',
  })
  findOne(@Param('agencyId') agencyId: string, @Param('id') id: string) {
    return this.curationService.findOne(agencyId, id);
  }

  @Patch(':id')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  update(
    @Param('agencyId') agencyId: string,
    @Param('id') id: string,
    @Body() body: UpdateCurationItemDto,
  ) {
    return this.curationService.update(agencyId, id, body);
  }

  @Delete(':id')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  remove(@Param('agencyId') agencyId: string, @Param('id') id: string) {
    return this.curationService.remove(agencyId, id);
  }
}
