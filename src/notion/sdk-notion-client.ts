import {
  APIErrorCode,
  APIResponseError,
  Client,
  RequestTimeoutError,
  isHTTPResponseError,
} from '@notionhq/client';
import {
  NotionApiError,
  NotionClientPort,
  NotionDataSourceSummary,
  NotionErrorKind,
  NotionPage,
  NotionProperties,
  QueryDatabaseParams,
  QueryDatabaseResult,
} from './notion.types';
import { readPlainText } from './mappers/notion-properties';

const ERROR_CODE_KINDS: Partial<Record<APIErrorCode, NotionErrorKind>> = {
  [APIErrorCode.Unauthorized]: 'UNAUTHORIZED',
  [APIErrorCode.RestrictedResource]: 'UNAUTHORIZED',
  [APIErrorCode.ObjectNotFound]: 'NOT_FOUND',
  [APIErrorCode.RateLimited]: 'RATE_LIMITED',
  [APIErrorCode.InvalidJSON]: 'VALIDATION',
  [APIErrorCode.InvalidRequestURL]: 'VALIDATION',
  [APIErrorCode.InvalidRequest]: 'VALIDATION',
  [APIErrorCode.ValidationError]: 'VALIDATION',
  [APIErrorCode.ConflictError]: 'CONFLICT',
  [APIErrorCode.InternalServerError]: 'SERVER_ERROR',
  [APIErrorCode.ServiceUnavailable]: 'SERVER_ERROR',
  [APIErrorCode.GatewayTimeout]: 'SERVER_ERROR',
};

/**
 * Traduit une erreur du SDK (ou toute autre) en `NotionApiError` : le reste de
 * l'application ne raisonne que sur `kind`/`status`, jamais sur les classes
 * de `@notionhq/client`. Le SDK a deja retente en interne les 429 et 5xx
 * (methodes idempotentes) avant d'abandonner : ce qui arrive ici est definitif
 * pour cette tentative.
 */
function toNotionApiError(error: unknown): NotionApiError {
  if (APIResponseError.isAPIResponseError(error)) {
    return new NotionApiError(
      error.message,
      ERROR_CODE_KINDS[error.code] ?? 'UNKNOWN',
      error.status,
    );
  }

  if (RequestTimeoutError.isRequestTimeoutError(error)) {
    return new NotionApiError(error.message, 'SERVER_ERROR');
  }

  if (isHTTPResponseError(error)) {
    return new NotionApiError(error.message, 'UNKNOWN', error.status);
  }

  return new NotionApiError(
    error instanceof Error ? error.message : String(error),
    'UNKNOWN',
  );
}

/**
 * Adaptateur reel du port Notion au dessus de @notionhq/client (API 2025).
 *
 * Depuis l'API "data sources", l'identifiant manipule (`databaseId` cote socle)
 * est un data_source_id : c'est lui qui porte les colonnes et les pages. Cet
 * adaptateur isole le reste de l'application de la forme exacte des reponses du
 * SDK : seuls `id`, `last_edited_time` et `properties` sont propages, et toute
 * erreur est normalisee en `NotionApiError` (cf. `toNotionApiError`).
 */
export class SdkNotionClient implements NotionClientPort {
  constructor(private readonly client: Client) {}

  async queryDatabase(
    params: QueryDatabaseParams,
  ): Promise<QueryDatabaseResult> {
    try {
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
    } catch (error) {
      throw toNotionApiError(error);
    }
  }

  async createPage(
    databaseId: string,
    properties: NotionProperties,
    markdown?: string | null,
  ): Promise<NotionPage> {
    try {
      const page = await this.client.pages.create({
        parent: { type: 'data_source_id', data_source_id: databaseId },
        properties: properties as never,
        ...(markdown ? { markdown } : {}),
      });

      return this.toNotionPage(page);
    } catch (error) {
      throw toNotionApiError(error);
    }
  }

  async updatePage(
    pageId: string,
    properties: NotionProperties,
  ): Promise<NotionPage> {
    try {
      const page = await this.client.pages.update({
        page_id: pageId,
        properties: properties as never,
      });

      return this.toNotionPage(page);
    } catch (error) {
      throw toNotionApiError(error);
    }
  }

  async retrievePage(pageId: string): Promise<NotionPage> {
    try {
      const page = await this.client.pages.retrieve({ page_id: pageId });

      return this.toNotionPage(page);
    } catch (error) {
      throw toNotionApiError(error);
    }
  }

  async archivePage(pageId: string): Promise<void> {
    try {
      await this.client.pages.update({ page_id: pageId, archived: true });
    } catch (error) {
      throw toNotionApiError(error);
    }
  }

  async setPageContent(pageId: string, markdown: string): Promise<void> {
    try {
      await this.client.pages.updateMarkdown({
        page_id: pageId,
        type: 'replace_content',
        replace_content: { new_str: markdown, allow_deleting_content: true },
      });
    } catch (error) {
      throw toNotionApiError(error);
    }
  }

  async searchDataSources(query: string): Promise<NotionDataSourceSummary[]> {
    try {
      const response = await this.client.search({
        query,
        filter: { property: 'object', value: 'data_source' },
      });

      return response.results
        .filter(
          (result): result is typeof result & { title: unknown } =>
            (result as { object?: string }).object === 'data_source' &&
            'title' in result,
        )
        .map((result) => {
          const record = result as unknown as {
            id: string;
            title: Array<{ plain_text?: string; text?: { content?: string } }>;
          };

          return { id: record.id, title: readPlainText(record.title) };
        });
    } catch (error) {
      throw toNotionApiError(error);
    }
  }

  private toNotionPage(result: unknown): NotionPage {
    const record = result as {
      id: string;
      last_edited_time?: string;
      properties?: Record<string, unknown>;
      in_trash?: boolean;
      archived?: boolean;
    };

    return {
      id: record.id,
      last_edited_time: record.last_edited_time ?? new Date().toISOString(),
      properties: (record.properties ?? {}) as NotionPage['properties'],
      inTrash: record.in_trash ?? record.archived ?? false,
    };
  }
}
