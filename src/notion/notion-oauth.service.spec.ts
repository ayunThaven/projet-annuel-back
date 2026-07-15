import { ConfigService } from '@nestjs/config';
import { NotionClientService } from './notion-client.service';
import { NotionOAuthService } from './notion-oauth.service';

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

/**
 * Teste uniquement `resolveDatabaseId` (auto-detection des bases Notion par
 * titre) : c'est ce qui permet a chaque agence de pointer vers ses propres
 * bases "Articles"/"Centre de ressources", meme si elle a duplique le
 * template dans son propre workspace, sans configuration manuelle.
 */
describe('NotionOAuthService — resolveDatabaseId (auto-detection)', () => {
  function buildService(overrides: {
    connection?: Record<string, unknown> | null;
    searchDataSources?: jest.Mock;
  }) {
    const connectionRepository = {
      findOne: jest.fn().mockResolvedValue(overrides.connection ?? null),
      save: jest
        .fn()
        .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    };

    const fakeClient = {
      searchDataSources:
        overrides.searchDataSources ?? jest.fn().mockResolvedValue([]),
    };

    const notionClient = { getClient: jest.fn().mockReturnValue(fakeClient) };

    const service = new NotionOAuthService(
      connectionRepository as never,
      {} as never,
      createConfig({ AI_SETTINGS_ENCRYPTION_KEY: 'test-encryption-secret' }),
      notionClient as unknown as NotionClientService,
    );

    return { service, connectionRepository, fakeClient, notionClient };
  }

  function encryptToken(service: NotionOAuthService, token: string): string {
    return (
      service as unknown as { encrypt: (value: string) => string }
    ).encrypt(token);
  }

  it("retourne null si l'agence n'a pas de connexion Notion", async () => {
    const { service } = buildService({ connection: null });

    await expect(
      service.resolveDatabaseId('agency-1', 'content'),
    ).resolves.toBeNull();
  });

  it('retourne la valeur en cache sans rechercher a nouveau', async () => {
    const { service, fakeClient } = buildService({
      connection: {
        accessTokenEncrypted: 'irrelevant',
        contentDatabaseId: 'cached-id',
        curationDatabaseId: null,
      },
    });

    const result = await service.resolveDatabaseId('agency-1', 'content');

    expect(result).toBe('cached-id');
    expect(fakeClient.searchDataSources).not.toHaveBeenCalled();
  });

  it("decouvre et met en cache l'id de la base Articles par titre", async () => {
    const { service, connectionRepository, fakeClient } = buildService({
      searchDataSources: jest.fn().mockResolvedValue([
        { id: 'other-id', title: 'Centre de ressources' },
        { id: 'articles-id', title: 'Articles' },
      ]),
    });
    const token = encryptToken(service, 'notion-token-123');
    connectionRepository.findOne.mockResolvedValue({
      accessTokenEncrypted: token,
      contentDatabaseId: null,
      curationDatabaseId: null,
    });

    const result = await service.resolveDatabaseId('agency-1', 'content');

    expect(result).toBe('articles-id');
    expect(fakeClient.searchDataSources).toHaveBeenCalledWith('Articles');
    expect(connectionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ contentDatabaseId: 'articles-id' }),
    );
  });

  it('retrouve la base meme si le titre exact ne correspond pas (ex: copie renommee)', async () => {
    const { service, connectionRepository } = buildService({
      searchDataSources: jest
        .fn()
        .mockResolvedValue([{ id: 'articles-id', title: 'Articles (copie)' }]),
    });
    const token = encryptToken(service, 'notion-token-123');
    connectionRepository.findOne.mockResolvedValue({
      accessTokenEncrypted: token,
      contentDatabaseId: null,
      curationDatabaseId: null,
    });

    const result = await service.resolveDatabaseId('agency-1', 'content');

    expect(result).toBe('articles-id');
  });

  it('retourne null sans planter si aucune base ne correspond au titre', async () => {
    const { service, connectionRepository } = buildService({
      searchDataSources: jest.fn().mockResolvedValue([]),
    });
    const token = encryptToken(service, 'notion-token-123');
    connectionRepository.findOne.mockResolvedValue({
      accessTokenEncrypted: token,
      contentDatabaseId: null,
      curationDatabaseId: null,
    });

    await expect(
      service.resolveDatabaseId('agency-1', 'content'),
    ).resolves.toBeNull();
  });

  it('retourne null si la recherche Notion echoue (au lieu de faire planter le push)', async () => {
    const { service, connectionRepository } = buildService({
      searchDataSources: jest.fn().mockRejectedValue(new Error('Notion down')),
    });
    const token = encryptToken(service, 'notion-token-123');
    connectionRepository.findOne.mockResolvedValue({
      accessTokenEncrypted: token,
      contentDatabaseId: null,
      curationDatabaseId: null,
    });

    await expect(
      service.resolveDatabaseId('agency-1', 'content'),
    ).resolves.toBeNull();
  });
});
