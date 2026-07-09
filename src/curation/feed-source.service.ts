import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFeedSourceDto } from './dto/create-feed-source.dto';
import { UpdateFeedSourceDto } from './dto/update-feed-source.dto';
import { FeedSourceEntity } from './entities/feed-source.entity';

/**
 * CRUD des flux RSS d'une agence.
 */
@Injectable()
export class FeedSourceService {
  constructor(
    @InjectRepository(FeedSourceEntity)
    private readonly feedRepository: Repository<FeedSourceEntity>,
  ) {}

  create(agencyId: string, dto: CreateFeedSourceDto) {
    const feed = this.feedRepository.create({
      agency: { id: agencyId },
      url: dto.url.trim(),
      name: dto.name ?? null,
      defaultTopics: dto.defaultTopics ?? null,
      enabled: true,
    });

    return this.feedRepository.save(feed);
  }

  findAll(agencyId: string) {
    return this.feedRepository.find({
      where: { agency: { id: agencyId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(agencyId: string, id: string) {
    const feed = await this.feedRepository.findOne({
      where: { id, agency: { id: agencyId } },
    });

    if (!feed) {
      throw new NotFoundException('Feed source not found');
    }

    return feed;
  }

  async update(agencyId: string, id: string, dto: UpdateFeedSourceDto) {
    const feed = await this.findOne(agencyId, id);

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (feed as unknown as Record<string, unknown>)[key] = value;
      }
    }

    if (dto.url !== undefined) {
      feed.url = dto.url.trim();
    }

    return this.feedRepository.save(feed);
  }

  async remove(agencyId: string, id: string) {
    const feed = await this.findOne(agencyId, id);

    await this.feedRepository.remove(feed);

    return { success: true };
  }
}
