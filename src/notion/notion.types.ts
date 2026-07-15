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
  /** Dans la corbeille Notion : visible via l'API mais plus sur le calendrier. */
  inTrash: boolean;
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
  /** `markdown` devient le corps (contenu) de la page a la creation. */
  createPage(
    databaseId: string,
    properties: NotionProperties,
    markdown?: string | null,
  ): Promise<NotionPage>;
  updatePage(pageId: string, properties: NotionProperties): Promise<NotionPage>;
  retrievePage(pageId: string): Promise<NotionPage>;
  /** Archive (soft-delete) une page, ex: contenu retire du calendrier. */
  archivePage(pageId: string): Promise<void>;
  /** Remplace integralement le corps (contenu) d'une page existante. */
  setPageContent(pageId: string, markdown: string): Promise<void>;
  /**
   * Recherche les data sources (bases) visibles par le token, filtrees par
   * titre. Sert a auto-detecter les bases "Articles"/"Centre de ressources"
   * d'un espace Notion connecte, sans configuration manuelle d'ID.
   */
  searchDataSources(query: string): Promise<NotionDataSourceSummary[]>;
}

/** Resume minimal d'une data source Notion trouvee par recherche. */
export interface NotionDataSourceSummary {
  id: string;
  title: string;
}

/** Fabrique un client a partir d'un token d'integration Notion. */
export type NotionClientFactory = (auth: string) => NotionClientPort;

/**
 * Categorisation SDK-agnostique d'un echec d'appel Notion, deduite du statut
 * HTTP / code d'erreur renvoye par l'API. Sert a decider comment reagir
 * (abandonner, auto-reparer, simplement journaliser) sans que le reste de
 * l'application ne connaisse la forme des erreurs de `@notionhq/client`.
 *
 * - UNAUTHORIZED  : token invalide/revoque -> inutile de retenter, reconnexion requise.
 * - NOT_FOUND     : page/base introuvable (supprimee, ou plus partagee avec l'integration).
 * - RATE_LIMITED  : quota depasse (le SDK a deja retente en interne avant d'abandonner).
 * - VALIDATION    : requete malformee -> ne se resoudra pas tout seul.
 * - CONFLICT      : etat concurrent cote Notion.
 * - SERVER_ERROR  : panne transitoire cote Notion (5xx, timeout).
 * - UNKNOWN       : tout le reste (erreur reseau, forme inattendue...).
 */
export type NotionErrorKind =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

/** Erreur normalisee levee par un `NotionClientPort` (ne fuite pas le SDK). */
export class NotionApiError extends Error {
  readonly name = 'NotionApiError';

  constructor(
    message: string,
    readonly kind: NotionErrorKind,
    readonly status?: number,
  ) {
    super(message);
  }
}
