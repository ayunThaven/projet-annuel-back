import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { SyncStatus } from '../common/enums/sync-status.enum';
import { CreateCurationItemDto } from './dto/create-curation-item.dto';
import { UpdateCurationItemDto } from './dto/update-curation-item.dto';
import { CurationItemEntity } from './entities/curation-item.entity';

/**
 * CRUD des ressources curees d'une agence.
 *
 * Comme pour les contenus, toute ecriture repasse l'element en `PENDING` pour
 * qu'il soit exporte vers Notion au prochain `push`.
 */
@Injectable()
export class CurationService {
  constructor(
    @InjectRepository(CurationItemEntity)
    private readonly curationRepository: Repository<CurationItemEntity>,
  ) {}

  create(agencyId: string, input: CreateCurationItemDto) {
    const item = this.curationRepository.create({
      agency: { id: agencyId } as AgencyEntity,
      title: input.title.trim(),
      sourceUrl: input.sourceUrl ?? null,
      source: input.source ?? null,
      topics: input.topics ?? null,
      status: input.status,
      curatedBy: input.curatedBy ?? null,
      notes: input.notes ?? null,
      syncStatus: SyncStatus.PENDING,
    });

    return this.curationRepository.save(item);
  }

  findAll(agencyId: string) {
    return this.curationRepository.find({
      where: { agency: { id: agencyId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(agencyId: string, id: string) {
    const item = await this.curationRepository.findOne({
      where: { id, agency: { id: agencyId } },
    });

    if (!item) {
      throw new NotFoundException('Curation item not found');
    }

    return item;
  }

  async update(agencyId: string, id: string, input: UpdateCurationItemDto) {
    const item = await this.findOne(agencyId, id);

    if (input.title !== undefined) item.title = input.title.trim();
    if (input.sourceUrl !== undefined) item.sourceUrl = input.sourceUrl;
    if (input.source !== undefined) item.source = input.source;
    if (input.topics !== undefined) item.topics = input.topics;
    if (input.status !== undefined) item.status = input.status;
    if (input.curatedBy !== undefined) item.curatedBy = input.curatedBy;
    if (input.notes !== undefined) item.notes = input.notes;

    item.syncStatus = SyncStatus.PENDING;

    return this.curationRepository.save(item);
  }

  async remove(agencyId: string, id: string) {
    const item = await this.findOne(agencyId, id);
    await this.curationRepository.remove(item);

    return { success: true };
  }
}
