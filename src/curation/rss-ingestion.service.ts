import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurationService } from './curation.service';
import { CurationItemEntity } from './entities/curation-item.entity';
import { FeedSourceEntity } from './entities/feed-source.entity';
import { RSS_PARSER } from './rss.types';
import type { RssParserPort } from './rss.types';

/**
 * Resultat d'une ingestion : ressources importees et doublons ignores.
 */
export interface IngestionSummary {
  imported: number;
  skipped: number;
}

/**
 * Ingestion des flux RSS vers la curation, avec anti-doublon par sourceUrl.
 */
@Injectable()
export class RssIngestionService {
  private readonly logger = new Logger(RssIngestionService.name);

  constructor(
    @Inject(RSS_PARSER)
    private readonly parser: RssParserPort,
    private readonly curationService: CurationService,
    @InjectRepository(CurationItemEntity)
    private readonly curationRepository: Repository<CurationItemEntity>,
    @InjectRepository(FeedSourceEntity)
    private readonly feedRepository: Repository<FeedSourceEntity>,
  ) {}

  async ingestFeed(
    agencyId: string,
    feed: FeedSourceEntity,
  ): Promise<IngestionSummary> {
    let parsed: Awaited<ReturnType<RssParserPort['parseURL']>>;
    try {
      parsed = await this.parser.parseURL(feed.url);
    } catch (error) {
      this.logger.warn(
        `Lecture du flux RSS impossible (${feed.url}): ${(error as Error).message}`,
      );
      throw new BadGatewayException(
        `Impossible de lire le flux RSS "${feed.name ?? feed.url}".`,
      );
    }
    const items = parsed.items ?? [];

    const links = items
      .map((item) => item.link)
      .filter((link): link is string => !!link);

    const existing = links.length
      ? await this.curationRepository.find({
          where: { agency: { id: agencyId }, sourceUrl: In(links) },
        })
      : [];
    const known = new Set(existing.map((item) => item.sourceUrl));

    let imported = 0;
    let skipped = 0;

    for (const item of items) {
      const link = item.link;

      if (!link || known.has(link)) {
        skipped += 1;
        continue;
      }

      known.add(link);

      await this.curationService.create(agencyId, {
        // status omis : la valeur par defaut de CurationStatus (TO_REVIEW)
        // s'applique, ce qui correspond a une ressource fraichement ingeree.
        title: item.title?.trim() || link,
        sourceUrl: link,
        source: feed.name ?? parsed.title ?? undefined,
        topics: feed.defaultTopics ?? undefined,
      });

      imported += 1;
    }

    feed.lastFetchedAt = new Date();
    await this.feedRepository.save(feed);

    return { imported, skipped };
  }

  async ingestAllForAgency(agencyId: string): Promise<IngestionSummary> {
    const feeds = await this.feedRepository.find({
      where: { agency: { id: agencyId }, enabled: true },
    });

    let imported = 0;
    let skipped = 0;

    for (const feed of feeds) {
      try {
        const summary = await this.ingestFeed(agencyId, feed);
        imported += summary.imported;
        skipped += summary.skipped;
      } catch (error) {
        this.logger.error(
          `Ingestion du flux ${feed.url} echouee`,
          error as Error,
        );
      }
    }

    return { imported, skipped };
  }
}
