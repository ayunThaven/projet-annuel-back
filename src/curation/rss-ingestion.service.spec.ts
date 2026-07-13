import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurationService } from './curation.service';
import { CurationItemEntity } from './entities/curation-item.entity';
import { FeedSourceEntity } from './entities/feed-source.entity';
import { RssIngestionService } from './rss-ingestion.service';
import { RSS_PARSER, RssParserPort } from './rss.types';

describe('RssIngestionService', () => {
  let service: RssIngestionService;
  let curationService: CurationService;
  let curationRepository: Repository<CurationItemEntity>;
  let feedRepository: Repository<FeedSourceEntity>;
  let parser: jest.Mocked<RssParserPort>;

  const feed = {
    id: 'feed-1',
    url: 'https://example.com/rss',
    name: 'Example Feed',
    defaultTopics: ['tech'],
    enabled: true,
    lastFetchedAt: null,
  } as FeedSourceEntity;

  beforeEach(async () => {
    parser = { parseURL: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RssIngestionService,
        { provide: RSS_PARSER, useValue: parser },
        { provide: CurationService, useValue: { create: jest.fn() } },
        {
          provide: getRepositoryToken(CurationItemEntity),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(FeedSourceEntity),
          useValue: { find: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(RssIngestionService);
    curationService = module.get(CurationService);
    curationRepository = module.get(getRepositoryToken(CurationItemEntity));
    feedRepository = module.get(getRepositoryToken(FeedSourceEntity));
  });

  describe('ingestFeed', () => {
    it('maps a feed entry to a curation item with feed metadata', async () => {
      parser.parseURL.mockResolvedValue({
        title: 'Example Feed',
        items: [
          { title: 'Article 1', link: 'https://example.com/a1' },
          { title: 'Article 2', link: 'https://example.com/a2' },
        ],
      });

      const result = await service.ingestFeed('agency-1', feed);

      expect(result).toEqual({ imported: 2, skipped: 0 });
      expect(curationService.create).toHaveBeenCalledWith('agency-1', {
        title: 'Article 1',
        sourceUrl: 'https://example.com/a1',
        source: 'Example Feed',
        topics: ['tech'],
      });
    });

    it('skips entries whose sourceUrl already exists (anti-doublon)', async () => {
      parser.parseURL.mockResolvedValue({
        items: [
          { title: 'Known', link: 'https://example.com/known' },
          { title: 'Fresh', link: 'https://example.com/fresh' },
        ],
      });
      jest
        .spyOn(curationRepository, 'find')
        .mockResolvedValue([
          { sourceUrl: 'https://example.com/known' } as CurationItemEntity,
        ]);

      const result = await service.ingestFeed('agency-1', feed);

      expect(result).toEqual({ imported: 1, skipped: 1 });
      expect(curationService.create).toHaveBeenCalledTimes(1);
      expect(curationService.create).toHaveBeenCalledWith(
        'agency-1',
        expect.objectContaining({ sourceUrl: 'https://example.com/fresh' }),
      );
    });

    it('skips duplicate links within the same batch', async () => {
      parser.parseURL.mockResolvedValue({
        items: [
          { title: 'Dup', link: 'https://example.com/dup' },
          { title: 'Dup again', link: 'https://example.com/dup' },
        ],
      });

      const result = await service.ingestFeed('agency-1', feed);

      expect(result).toEqual({ imported: 1, skipped: 1 });
    });

    it('skips entries without a link', async () => {
      parser.parseURL.mockResolvedValue({
        items: [{ title: 'No link' }],
      });

      const result = await service.ingestFeed('agency-1', feed);

      expect(result).toEqual({ imported: 0, skipped: 1 });
      expect(curationService.create).not.toHaveBeenCalled();
    });

    it('throws BadGatewayException when the feed cannot be parsed', async () => {
      parser.parseURL.mockRejectedValue(new Error('Status code 404'));

      await expect(service.ingestFeed('agency-1', feed)).rejects.toThrow(
        'Impossible de lire le flux RSS',
      );
      expect(curationService.create).not.toHaveBeenCalled();
    });

    it('updates lastFetchedAt on the feed', async () => {
      parser.parseURL.mockResolvedValue({ items: [] });

      await service.ingestFeed('agency-1', feed);

      expect(feedRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'feed-1' }),
      );
      const saved = (feedRepository.save as jest.Mock).mock.calls[0][0];
      expect(saved.lastFetchedAt).toBeInstanceOf(Date);
    });
  });

  describe('ingestAllForAgency', () => {
    it('aggregates summaries across enabled feeds', async () => {
      jest.spyOn(feedRepository, 'find').mockResolvedValue([feed, feed]);
      jest
        .spyOn(service, 'ingestFeed')
        .mockResolvedValue({ imported: 2, skipped: 1 });

      const result = await service.ingestAllForAgency('agency-1');

      expect(result).toEqual({ imported: 4, skipped: 2 });
    });

    it('continues when a feed ingestion throws', async () => {
      jest.spyOn(feedRepository, 'find').mockResolvedValue([feed, feed]);
      jest
        .spyOn(service, 'ingestFeed')
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ imported: 1, skipped: 0 });

      const result = await service.ingestAllForAgency('agency-1');

      expect(result).toEqual({ imported: 1, skipped: 0 });
    });
  });
});
