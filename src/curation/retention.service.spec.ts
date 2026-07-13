import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RetentionService } from './retention.service';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { CurationItemEntity } from './entities/curation-item.entity';
import { SyncStatus } from '../common/enums/sync-status.enum';

describe('RetentionService', () => {
  let service: RetentionService;
  let contentRepository: Repository<ContentItemEntity>;
  let curationRepository: Repository<CurationItemEntity>;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        {
          provide: getRepositoryToken(ContentItemEntity),
          useValue: { delete: jest.fn().mockResolvedValue({ affected: 2 }) },
        },
        {
          provide: getRepositoryToken(CurationItemEntity),
          useValue: { delete: jest.fn().mockResolvedValue({ affected: 3 }) },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(RetentionService);
    contentRepository = module.get(getRepositoryToken(ContentItemEntity));
    curationRepository = module.get(getRepositoryToken(CurationItemEntity));
    configService = module.get(ConfigService);
  });

  it('purges only SYNCED items older than the cutoff', async () => {
    const result = await service.purgeExpired();

    expect(result).toEqual({ content: 2, curation: 3 });

    const contentWhere = (contentRepository.delete as jest.Mock).mock
      .calls[0][0];
    expect(contentWhere.syncStatus).toBe(SyncStatus.SYNCED);
    expect(contentWhere.createdAt).toBeDefined();

    const curationWhere = (curationRepository.delete as jest.Mock).mock
      .calls[0][0];
    expect(curationWhere.syncStatus).toBe(SyncStatus.SYNCED);
  });

  it('defaults to 30 days when RETENTION_DAYS is not configured', async () => {
    jest.spyOn(configService, 'get').mockReturnValue(undefined);

    await service.purgeExpired();

    const where = (contentRepository.delete as jest.Mock).mock.calls[0][0];
    const cutoff: Date = where.createdAt._value ?? where.createdAt.value;
    const daysAgo = (Date.now() - new Date(cutoff).getTime()) / 86_400_000;
    expect(Math.round(daysAgo)).toBe(30);
  });

  it('honours a custom RETENTION_DAYS value', async () => {
    jest.spyOn(configService, 'get').mockReturnValue(7);

    await service.purgeExpired();

    const where = (contentRepository.delete as jest.Mock).mock.calls[0][0];
    const cutoff: Date = where.createdAt._value ?? where.createdAt.value;
    const daysAgo = (Date.now() - new Date(cutoff).getTime()) / 86_400_000;
    expect(Math.round(daysAgo)).toBe(7);
  });
});
