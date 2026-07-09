import { SyncStatus } from '../common/enums/sync-status.enum';

/**
 * Contrat porte par toute entite synchronisable avec Notion.
 *
 * Il regroupe le "socle sync" (pointeur Notion + horodatages + statut) pour que
 * le NotionSyncService puisse traiter Contenus et Curation de façon generique.
 */
export interface NotionSyncable {
  id: string;
  /** Identifiant de la page Notion miroir, null tant qu'elle n'existe pas. */
  notionPageId: string | null;
  /** last_edited_time de la page Notion lors de la derniere sync. */
  notionLastEditedAt: Date | null;
  /** Instant de la derniere synchronisation reussie. */
  lastSyncedAt: Date | null;
  syncStatus: SyncStatus;
  /** Derniere modification cote application (colonne @UpdateDateColumn). */
  updatedAt: Date;
}
