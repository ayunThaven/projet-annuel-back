import { ContentItemEntity } from '../../content/entities/content-item.entity';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { NotionPage, NotionProperties } from '../notion.types';
import {
  buildDate,
  buildSelect,
  buildTitle,
  readDate,
  readSelect,
  readTitle,
} from './notion-properties';

/**
 * Statuts consideres "sur le calendrier editorial" : seuls les contenus dans
 * un de ces statuts sont pousses vers la base Notion "Articles" (et donc
 * visibles dans sa vue calendrier). Un retour a un statut anterieur (ex:
 * DRAFT) declenche l'archivage de la page Notion existante.
 */
export const CALENDAR_ELIGIBLE_STATUSES: ContentStatus[] = [
  ContentStatus.SCHEDULED,
  ContentStatus.PUBLISHED,
];

/**
 * Noms des colonnes de la base Notion "Articles" (calendrier editorial).
 *
 * Alignes sur le template reel duplique : cette base ne porte que le titre, la
 * date de publication et une categorie. Les autres champs de ContentItemEntity
 * (status, url, tags, notes...) n'ont pas de colonne et ne sont donc pas
 * synchronises pour l'instant.
 */
export const CONTENT_PROPERTIES = {
  title: "Nom de l'article",
  publicationDate: 'Date de publication',
  category: 'Catégorie',
} as const;

/** Encode un contenu applicatif vers les proprietes d'une page Notion. */
export function toNotionProperties(
  entity: Pick<ContentItemEntity, 'title' | 'publicationDate' | 'channel'>,
): NotionProperties {
  return {
    [CONTENT_PROPERTIES.title]: buildTitle(entity.title),
    [CONTENT_PROPERTIES.publicationDate]: buildDate(entity.publicationDate),
    // La "Catégorie" Notion est portee par le champ applicatif `channel`.
    [CONTENT_PROPERTIES.category]: buildSelect(entity.channel),
  };
}

/** Decode une page Notion vers les champs metier d'un contenu. */
export function fromNotionPage(page: NotionPage): Partial<ContentItemEntity> {
  return {
    title: readTitle(page, CONTENT_PROPERTIES.title),
    publicationDate: readDate(page, CONTENT_PROPERTIES.publicationDate),
    channel: readSelect(page, CONTENT_PROPERTIES.category),
  };
}
