/**
 * Types minimaux decrivant les objets Notion que le socle manipule.
 *
 * On ne depend volontairement pas des types complets du SDK : cette surface
 * reduite suffit aux mappers et rend les fixtures de test triviales a ecrire.
 */

/** Valeur d'une propriete telle que renvoyee par l'API Notion (lecture). */
export type NotionPropertyValue = Record<string, unknown>;

/** Dictionnaire de proprietes envoye a l'API Notion (ecriture). */
export type NotionProperties = Record<string, NotionPropertyValue>;

/** Page Notion (sous-ensemble des champs utilises par le socle). */
export interface NotionPage {
  id: string;
  last_edited_time: string;
  properties: Record<string, NotionPropertyValue>;
}

export interface QueryDatabaseParams {
  databaseId: string;
  /** Filtre Notion optionnel (ex: last_edited_time). */
  filter?: unknown;
  startCursor?: string;
  pageSize?: number;
}

export interface QueryDatabaseResult {
  pages: NotionPage[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Port applicatif du client Notion.
 *
 * L'implementation reelle (SdkNotionClient) enveloppe @notionhq/client. Les
 * tests injectent un FakeNotionClient : aucune sortie reseau n'a lieu.
 */
export interface NotionClientPort {
  queryDatabase(params: QueryDatabaseParams): Promise<QueryDatabaseResult>;
  createPage(
    databaseId: string,
    properties: NotionProperties,
  ): Promise<NotionPage>;
  updatePage(pageId: string, properties: NotionProperties): Promise<NotionPage>;
  retrievePage(pageId: string): Promise<NotionPage>;
}

/** Fabrique un client a partir d'un token d'integration Notion. */
export type NotionClientFactory = (auth: string) => NotionClientPort;
