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
import { ContentService } from './content.service';
import { CreateContentItemDto } from './dto/create-content-item.dto';
import { UpdateContentItemDto } from './dto/update-content-item.dto';

/**
 * CRUD des contenus editoriaux, scope a une agence.
 *
 * Lecture ouverte aux 3 roles ; ecriture reservee OWNER/EDITOR.
 */
@Controller('agencies/:agencyId/content')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  create(
    @Param('agencyId') agencyId: string,
    @Body() body: CreateContentItemDto,
  ) {
    return this.contentService.create(agencyId, body);
  }

  @Get()
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, AgencyRole.VIEWER, {
    agencyIdSource: 'params',
  })
  findAll(@Param('agencyId') agencyId: string) {
    return this.contentService.findAll(agencyId);
  }

  @Get(':id')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, AgencyRole.VIEWER, {
    agencyIdSource: 'params',
  })
  findOne(@Param('agencyId') agencyId: string, @Param('id') id: string) {
    return this.contentService.findOne(agencyId, id);
  }

  @Patch(':id')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  update(
    @Param('agencyId') agencyId: string,
    @Param('id') id: string,
    @Body() body: UpdateContentItemDto,
  ) {
    return this.contentService.update(agencyId, id, body);
  }

  @Delete(':id')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  remove(@Param('agencyId') agencyId: string, @Param('id') id: string) {
    return this.contentService.remove(agencyId, id);
  }
}
