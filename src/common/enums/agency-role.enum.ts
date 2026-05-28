/**
 * Roles MVP pour le mode agence.
 *
 * OWNER administre l'agence, EDITOR peut contribuer, VIEWER consulte seulement.
 */
export enum AgencyRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}
