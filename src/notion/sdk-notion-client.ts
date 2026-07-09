import { Client } from '@notionhq/client';
import {
  NotionClientPort,
  NotionPage,
  NotionProperties,
  QueryDatabaseParams,
  QueryDatabaseResult,
} from './notion.types';

/**
 * Adaptateur reel du port Notion au dessus de @notionhq/client (API 2025).
 *
 * Depuis l'API "data sources", l'identifiant manipule (`databaseId` cote socle)
 * est un data_source_id : c'est lui qui porte les colonnes et les pages. Cet
 * adaptateur isole le reste de l'application de la forme exacte des reponses du
 * SDK : seuls `id`, `last_edited_time` et `properties` sont propages.
 */
export class SdkNotionClient implements NotionClientPort {
  constructor(private readonly client: Client) {}

  async queryDatabase(
    params: QueryDatabaseParams,
  ): Promise<QueryDatabaseResult> {
    const response = await this.client.dataSources.query({
      data_source_id: params.databaseId,
      ...(params.filter ? { filter: params.filter as never } : {}),
      ...(params.startCursor ? { start_cursor: params.startCursor } : {}),
      ...(params.pageSize ? { page_size: params.pageSize } : {}),
    });

    return {
      pages: response.results.map((result) => this.toNotionPage(result)),
      nextCursor: response.next_cursor,
      hasMore: response.has_more,
    };
  }

  async createPage(
    databaseId: string,
    properties: NotionProperties,
  ): Promise<NotionPage> {
    const page = await this.client.pages.create({
      parent: { type: 'data_source_id', data_source_id: databaseId },
      properties: properties as never,
    });

    return this.toNotionPage(page);
  }

  async updatePage(
    pageId: string,
    properties: NotionProperties,
  ): Promise<NotionPage> {
    const page = await this.client.pages.update({
      page_id: pageId,
      properties: properties as never,
    });

    return this.toNotionPage(page);
  }

  async retrievePage(pageId: string): Promise<NotionPage> {
    const page = await this.client.pages.retrieve({ page_id: pageId });

    return this.toNotionPage(page);
  }

  private toNotionPage(result: unknown): NotionPage {
    const record = result as {
      id: string;
      last_edited_time?: string;
      properties?: Record<string, unknown>;
    };

    return {
      id: record.id,
      last_edited_time: record.last_edited_time ?? new Date().toISOString(),
      properties: (record.properties ?? {}) as NotionPage['properties'],
    };
  }
}
