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
import { CreateFeedSourceDto } from './dto/create-feed-source.dto';
import { UpdateFeedSourceDto } from './dto/update-feed-source.dto';
import { FeedSourceService } from './feed-source.service';
import { RssIngestionService } from './rss-ingestion.service';

/**
 * Gestion des flux RSS d'une agence et declenchement manuel de l'ingestion.
 */
@Controller('agencies/:agencyId/curation/feeds')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class FeedSourceController {
  constructor(
    private readonly feedSourceService: FeedSourceService,
    private readonly rssIngestionService: RssIngestionService,
  ) {}

  @Post()
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  create(
    @Param('agencyId') agencyId: string,
    @Body() body: CreateFeedSourceDto,
  ) {
    return this.feedSourceService.create(agencyId, body);
  }

  @Get()
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, AgencyRole.VIEWER, {
    agencyIdSource: 'params',
  })
  findAll(@Param('agencyId') agencyId: string) {
    return this.feedSourceService.findAll(agencyId);
  }

  @Patch(':id')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  update(
    @Param('agencyId') agencyId: string,
    @Param('id') id: string,
    @Body() body: UpdateFeedSourceDto,
  ) {
    return this.feedSourceService.update(agencyId, id, body);
  }

  @Delete(':id')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  remove(@Param('agencyId') agencyId: string, @Param('id') id: string) {
    return this.feedSourceService.remove(agencyId, id);
  }

  @Post(':id/ingest')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  async ingestOne(
    @Param('agencyId') agencyId: string,
    @Param('id') id: string,
  ) {
    const feed = await this.feedSourceService.findOne(agencyId, id);
    return this.rssIngestionService.ingestFeed(agencyId, feed);
  }

  @Post('ingest')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  ingestAll(@Param('agencyId') agencyId: string) {
    return this.rssIngestionService.ingestAllForAgency(agencyId);
  }
}
