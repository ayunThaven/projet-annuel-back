import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { FeedSourceService } from './feed-source.service';
import { FeedSourceEntity } from './entities/feed-source.entity';

describe('FeedSourceService', () => {
  let service: FeedSourceService;
  let repository: Repository<FeedSourceEntity>;

  const mockFeed = {
    id: 'feed-1',
    url: 'https://example.com/rss',
    name: 'Example',
    defaultTopics: ['tech'],
    enabled: true,
    lastFetchedAt: null,
  } as FeedSourceEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedSourceService,
        {
          provide: getRepositoryToken(FeedSourceEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FeedSourceService);
    repository = module.get(getRepositoryToken(FeedSourceEntity));
  });

  describe('create', () => {
    it('creates an enabled feed attached to the agency and trims url', () => {
      jest.spyOn(repository, 'create').mockReturnValue({} as any);
      jest.spyOn(repository, 'save').mockResolvedValue({} as any);

      service.create('agency-1', { url: '  https://example.com/rss  ' });

      const call = (repository.create as jest.Mock).mock.calls[0][0];
      expect(call).toEqual({
        agency: { id: 'agency-1' },
        url: 'https://example.com/rss',
        name: null,
        defaultTopics: null,
        enabled: true,
      });
    });
  });

  describe('findAll', () => {
    it('returns feeds for the agency ordered by creation date DESC', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([mockFeed]);

      const result = await service.findAll('agency-1');

      expect(repository.find).toHaveBeenCalledWith({
        where: { agency: { id: 'agency-1' } },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockFeed]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the feed is missing', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('agency-1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('applies changes and can disable a feed', async () => {
      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ ...mockFeed } as any);
      jest
        .spyOn(repository, 'save')
        .mockImplementation(async (f) => f as FeedSourceEntity);

      const result = await service.update('agency-1', 'feed-1', {
        enabled: false,
      });

      expect(result.enabled).toBe(false);
    });
  });

  describe('remove', () => {
    it('removes the feed and returns success', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockFeed as any);
      jest.spyOn(repository, 'remove').mockResolvedValue(mockFeed as any);

      const result = await service.remove('agency-1', 'feed-1');

      expect(repository.remove).toHaveBeenCalledWith(mockFeed);
      expect(result).toEqual({ success: true });
    });
  });
});
