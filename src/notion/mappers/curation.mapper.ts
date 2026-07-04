import { CurationStatus } from '../../common/enums/curation-status.enum';
import { CurationItemEntity } from '../../curation/entities/curation-item.entity';
import { NotionPage, NotionProperties } from '../notion.types';
import {
  buildMultiSelect,
  buildRichText,
  buildStatus,
  buildTitle,
  buildUrl,
  readMultiSelect,
  readRichText,
  readStatus,
  readTitle,
  readUrl,
} from './notion-properties';

/**
 * Noms des colonnes de la base Notion "Centre de ressources" (curation),
 * alignes sur le template reel duplique.
 */
export const CURATION_PROPERTIES = {
  title: 'Nom du document',
  sourceUrl: 'Source',
  topics: 'Catégorie',
  status: 'État',
  notes: 'Résumé',
} as const;

/** Statut applicatif -> libelle exact de la colonne "État" dans Notion. */
const STATUS_TO_NOTION: Record<CurationStatus, string> = {
  [CurationStatus.TO_REVIEW]: 'A lire',
  [CurationStatus.REVIEWED]: 'Validée',
  [CurationStatus.SHARED]: 'Archivée',
};

const STATUS_FROM_NOTION: Record<string, CurationStatus> = Object.fromEntries(
  Object.entries(STATUS_TO_NOTION).map(([status, label]) => [
    label.toLowerCase(),
    status as CurationStatus,
  ]),
);

/** Encode une ressource curee applicative vers une page Notion. */
export function toNotionProperties(
  entity: Pick<
    CurationItemEntity,
    'title' | 'sourceUrl' | 'topics' | 'status' | 'notes'
  >,
): NotionProperties {
  return {
    [CURATION_PROPERTIES.title]: buildTitle(entity.title),
    [CURATION_PROPERTIES.sourceUrl]: buildUrl(entity.sourceUrl),
    [CURATION_PROPERTIES.topics]: buildMultiSelect(entity.topics),
    [CURATION_PROPERTIES.status]: buildStatus(STATUS_TO_NOTION[entity.status]),
    [CURATION_PROPERTIES.notes]: buildRichText(entity.notes),
  };
}

/** Decode une page Notion vers les champs metier d'une ressource curee. */
export function fromNotionPage(page: NotionPage): Partial<CurationItemEntity> {
  const topics = readMultiSelect(page, CURATION_PROPERTIES.topics);

  return {
    title: readTitle(page, CURATION_PROPERTIES.title),
    sourceUrl: readUrl(page, CURATION_PROPERTIES.sourceUrl),
    topics: topics.length ? topics : null,
    status: notionStatusToCuration(readStatus(page, CURATION_PROPERTIES.status)),
    notes: readRichText(page, CURATION_PROPERTIES.notes),
  };
}

function notionStatusToCuration(label: string | null): CurationStatus {
  if (!label) {
    return CurationStatus.TO_REVIEW;
  }

  return STATUS_FROM_NOTION[label.toLowerCase()] ?? CurationStatus.TO_REVIEW;
}
