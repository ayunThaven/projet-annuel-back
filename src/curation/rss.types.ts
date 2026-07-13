/**
 * Token d'injection du parseur RSS. Abstrait pour rester mockable (aucun appel
 * reseau reel dans les tests).
 */
export const RSS_PARSER = Symbol('RSS_PARSER');

/**
 * Entree normalisee d'un flux RSS.
 */
export interface RssItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  isoDate?: string;
}

export interface RssFeed {
  title?: string;
  items: RssItem[];
}

/**
 * Port abstrait vers un parseur RSS (implemente par rss-parser en production).
 */
export interface RssParserPort {
  parseURL(url: string): Promise<RssFeed>;
}
