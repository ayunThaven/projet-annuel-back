/**
 * Etat de synchronisation d'une entite avec Notion.
 *
 * PENDING : modifiee cote application, doit etre poussee vers Notion.
 * SYNCED  : alignee avec Notion depuis la derniere synchronisation.
 * CONFLICT: modifiee des deux cotes entre deux syncs (resolue last-write-wins).
 * ERROR   : la derniere synchronisation a echoue, a rejouer.
 */
export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  CONFLICT = 'CONFLICT',
  ERROR = 'ERROR',
}
