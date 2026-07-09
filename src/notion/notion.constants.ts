/**
 * Token d'injection de la fabrique de client Notion.
 *
 * En production, il resout vers un SdkNotionClient (@notionhq/client). En test,
 * on le remplace par une fabrique retournant un FakeNotionClient en memoire.
 */
export const NOTION_CLIENT_FACTORY = 'NOTION_CLIENT_FACTORY';
