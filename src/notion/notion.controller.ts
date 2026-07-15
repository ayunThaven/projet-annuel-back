import {
  Controller,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { AgencyRoles } from '../agencies/decorators/agency-roles.decorator';
import { AgencyRolesGuard } from '../agencies/guards/agency-roles.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { NotionSyncService } from './notion-sync.service';

/**
 * Declencheurs manuels de synchronisation Notion pour une agence.
 *
 * Reserve aux roles OWNER/EDITOR : un VIEWER ne peut pas pousser ni importer.
 */
@Controller('agencies/:agencyId/notion/sync')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class NotionController {
  constructor(
    private readonly notionSync: NotionSyncService,
    @InjectRepository(AgencyEntity)
    private readonly agenciesRepository: Repository<AgencyEntity>,
  ) {}

  @Post('push')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  async push(@Param('agencyId') agencyId: string) {
    const agency = await this.loadAgency(agencyId);
    return this.notionSync.pushAll(agency);
  }

  /**
   * Force la resynchronisation des contenus planifies/publies (calendrier
   * editorial) uniquement, sans toucher a la curation. Sert de filet de
   * secours manuel si le push automatique (declenche a la planification) a
   * echoue silencieusement pour une raison ou une autre. Revient aussi sur
   * les pages deja marquees "synchronisees" pour confirmer qu'elles existent
   * toujours reellement cote Notion (pas supprimees/mises a la corbeille a la
   * main sans que l'app ne le sache).
   */
  @Post('push-content')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  async pushContent(@Param('agencyId') agencyId: string) {
    const agency = await this.loadAgency(agencyId);
    return this.notionSync.pushContentWithVerification(agency);
  }

  @Post('pull')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, {
    agencyIdSource: 'params',
  })
  async pull(@Param('agencyId') agencyId: string) {
    const agency = await this.loadAgency(agencyId);
    return this.notionSync.pullAll(agency);
  }

  private async loadAgency(agencyId: string): Promise<AgencyEntity> {
    const agency = await this.agenciesRepository.findOne({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    return agency;
  }
}
