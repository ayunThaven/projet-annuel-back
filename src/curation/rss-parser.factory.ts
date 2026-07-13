import Parser from 'rss-parser';
import { RssFeed, RssParserPort } from './rss.types';

/**
 * Implementation de production du port RSS, basee sur rss-parser.
 */
export const rssParser: RssParserPort = {
  async parseURL(url: string): Promise<RssFeed> {
    const parser = new Parser();
    const feed = await parser.parseURL(url);
    return {
      title: feed.title,
      items: (feed.items ?? []).map((item) => ({
        title: item.title,
        link: item.link,
        contentSnippet: item.contentSnippet,
        isoDate: item.isoDate,
      })),
    };
  },
};
