import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { SyncStatus } from '../common/enums/sync-status.enum';
import { CreateContentItemDto } from './dto/create-content-item.dto';
import { UpdateContentItemDto } from './dto/update-content-item.dto';
import { ContentItemEntity } from './entities/content-item.entity';

/**
 * CRUD des contenus editoriaux d'une agence.
 *
 * Toute creation ou modification repasse l'element en `PENDING` : c'est ce qui
 * declenchera son export vers Notion au prochain `push`.
 */
@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentItemEntity)
    private readonly contentRepository: Repository<ContentItemEntity>,
  ) {}

  create(agencyId: string, input: CreateContentItemDto) {
    const item = this.contentRepository.create({
      agency: { id: agencyId } as AgencyEntity,
      title: input.title.trim(),
      status: input.status,
      publicationDate: input.publicationDate
        ? new Date(input.publicationDate)
        : null,
      channel: input.channel ?? null,
      contentType: input.contentType ?? null,
      url: input.url ?? null,
      tags: input.tags ?? null,
      notes: input.notes ?? null,
      syncStatus: SyncStatus.PENDING,
    });

    return this.contentRepository.save(item);
  }

  findAll(agencyId: string) {
    return this.contentRepository.find({
      where: { agency: { id: agencyId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(agencyId: string, id: string) {
    const item = await this.contentRepository.findOne({
      where: { id, agency: { id: agencyId } },
    });

    if (!item) {
      throw new NotFoundException('Content item not found');
    }

    return item;
  }

  async update(agencyId: string, id: string, input: UpdateContentItemDto) {
    const item = await this.findOne(agencyId, id);

    if (input.title !== undefined) item.title = input.title.trim();
    if (input.status !== undefined) item.status = input.status;
    if (input.publicationDate !== undefined) {
      item.publicationDate = input.publicationDate
        ? new Date(input.publicationDate)
        : null;
    }
    if (input.channel !== undefined) item.channel = input.channel;
    if (input.contentType !== undefined) item.contentType = input.contentType;
    if (input.url !== undefined) item.url = input.url;
    if (input.tags !== undefined) item.tags = input.tags;
    if (input.notes !== undefined) item.notes = input.notes;

    // Modifie cote application : a re-exporter vers Notion.
    item.syncStatus = SyncStatus.PENDING;

    return this.contentRepository.save(item);
  }

  async remove(agencyId: string, id: string) {
    const item = await this.findOne(agencyId, id);
    await this.contentRepository.remove(item);

    return { success: true };
  }
}
