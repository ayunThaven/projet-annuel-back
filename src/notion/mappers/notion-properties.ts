import { NotionPage, NotionPropertyValue } from '../notion.types';

/**
 * Constructeurs et lecteurs de proprietes Notion.
 *
 * Fonctions pures, sans I/O : elles encodent les valeurs applicatives vers la
 * forme attendue par l'API et decodent les pages renvoyees. Toute la logique de
 * format Notion vit ici, ce qui rend les mappers metier lisibles et testables.
 */

// --- Constructeurs (application -> Notion) ---

export function buildTitle(value: string): NotionPropertyValue {
  return { title: [{ type: 'text', text: { content: value ?? '' } }] };
}

export function buildRichText(value: string | null): NotionPropertyValue {
  return {
    rich_text: value ? [{ type: 'text', text: { content: value } }] : [],
  };
}

export function buildSelect(name: string | null): NotionPropertyValue {
  return { select: name ? { name } : null };
}

export function buildStatus(name: string | null): NotionPropertyValue {
  return { status: name ? { name } : null };
}

export function buildMultiSelect(names: string[] | null): NotionPropertyValue {
  return {
    multi_select: (names ?? []).map((name) => ({ name })),
  };
}

export function buildDate(value: Date | null): NotionPropertyValue {
  return { date: value ? { start: value.toISOString() } : null };
}

export function buildUrl(value: string | null): NotionPropertyValue {
  return { url: value ?? null };
}

// --- Lecteurs (Notion -> application) ---

function property(
  page: NotionPage,
  key: string,
): NotionPropertyValue | undefined {
  return page.properties?.[key];
}

export function readTitle(page: NotionPage, key: string): string {
  const items = property(page, key)?.title as
    | Array<{ plain_text?: string; text?: { content?: string } }>
    | undefined;

  return readPlainText(items);
}

export function readRichText(page: NotionPage, key: string): string | null {
  const items = property(page, key)?.rich_text as
    | Array<{ plain_text?: string; text?: { content?: string } }>
    | undefined;

  const value = readPlainText(items);

  return value === '' ? null : value;
}

export function readSelect(page: NotionPage, key: string): string | null {
  const select = property(page, key)?.select as { name?: string } | null;

  return select?.name ?? null;
}

export function readStatus(page: NotionPage, key: string): string | null {
  const status = property(page, key)?.status as { name?: string } | null;

  return status?.name ?? null;
}

export function readMultiSelect(page: NotionPage, key: string): string[] {
  const values = property(page, key)?.multi_select as
    | Array<{ name?: string }>
    | undefined;

  return (values ?? [])
    .map((item) => item.name)
    .filter((name): name is string => typeof name === 'string');
}

export function readDate(page: NotionPage, key: string): Date | null {
  const date = property(page, key)?.date as { start?: string } | null;

  return date?.start ? new Date(date.start) : null;
}

export function readUrl(page: NotionPage, key: string): string | null {
  const url = property(page, key)?.url as string | null | undefined;

  return url ?? null;
}

/** Concatene le texte brut d'un tableau de rich text Notion (title, etc). */
export function readPlainText(
  items:
    | Array<{ plain_text?: string; text?: { content?: string } }>
    | undefined,
): string {
  if (!items?.length) {
    return '';
  }

  return items
    .map((item) => item.plain_text ?? item.text?.content ?? '')
    .join('');
}
