import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { ContentStatus } from '../common/enums/content-status.enum';
import { SyncStatus } from '../common/enums/sync-status.enum';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { CurationItemEntity } from '../curation/entities/curation-item.entity';
import { NotionClientService } from './notion-client.service';
import { NotionOAuthService } from './notion-oauth.service';
import { NotionSyncService } from './notion-sync.service';
import { NotionApiError, NotionClientPort, NotionPage } from './notion.types';

function page(id: string): NotionPage {
  return { id, last_edited_time: '2026-07-01T00:00:00.000Z', properties: {} };
}

describe('NotionSyncService', () => {
  let service: NotionSyncService;
  let contentRepository: { find: jest.Mock; save: jest.Mock };
  let fakeClient: jest.Mocked<NotionClientPort>;
  let notionOAuth: {
    getRuntimeToken: jest.Mock;
    resolveDatabaseId: jest.Mock;
  };

  const agency = { id: 'agency-1', notionDatabaseId: 'db-1' } as AgencyEntity;

  beforeEach(async () => {
    fakeClient = {
      queryDatabase: jest.fn(),
      createPage: jest.fn().mockResolvedValue(page('page-created')),
      updatePage: jest.fn().mockResolvedValue(page('page-updated')),
      retrievePage: jest.fn(),
      archivePage: jest.fn().mockResolvedValue(undefined),
      searchDataSources: jest.fn().mockResolvedValue([]),
    };

    contentRepository = {
      find: jest.fn().mockResolvedValue([]),
      save: jest
        .fn()
        .mockImplementation((entity: unknown) => Promise.resolve(entity)),
      metadata: { name: ContentItemEntity.name },
    } as never;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotionSyncService,
        {
          provide: getRepositoryToken(ContentItemEntity),
          useValue: contentRepository,
        },
        {
          provide: getRepositoryToken(CurationItemEntity),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: NotionClientService,
          useValue: { getClient: jest.fn().mockReturnValue(fakeClient) },
        },
        {
          provide: NotionOAuthService,
          useFactory: () => {
            notionOAuth = {
              getRuntimeToken: jest.fn().mockResolvedValue('token'),
              resolveDatabaseId: jest.fn().mockResolvedValue(null),
            };
            return notionOAuth;
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(NotionSyncService);
  });

  describe('pushContent — filtre calendrier', () => {
    it('cree une page Notion pour un contenu planifie', async () => {
      const scheduled = {
        id: 'c1',
        status: ContentStatus.SCHEDULED,
        notionPageId: null,
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      contentRepository.find.mockResolvedValue([scheduled]);

      const summary = await service.pushContent(agency);

      expect(fakeClient.createPage).toHaveBeenCalledTimes(1);
      expect(summary.created).toBe(1);
      expect(scheduled.syncStatus).toBe(SyncStatus.SYNCED);
    });

    it('archive la page Notion existante quand le contenu repasse en brouillon', async () => {
      const reverted = {
        id: 'c2',
        status: ContentStatus.DRAFT,
        notionPageId: 'page-existing',
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      contentRepository.find.mockResolvedValue([reverted]);

      const summary = await service.pushContent(agency);

      expect(fakeClient.archivePage).toHaveBeenCalledWith('page-existing');
      expect(fakeClient.createPage).not.toHaveBeenCalled();
      expect(fakeClient.updatePage).not.toHaveBeenCalled();
      expect(reverted.notionPageId).toBeNull();
      expect(reverted.syncStatus).toBe(SyncStatus.SYNCED);
      expect(summary.updated).toBe(1);
    });

    it('ignore un brouillon jamais synchronise (rien a archiver)', async () => {
      const draft = {
        id: 'c3',
        status: ContentStatus.DRAFT,
        notionPageId: null,
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      contentRepository.find.mockResolvedValue([draft]);

      const summary = await service.pushContent(agency);

      expect(fakeClient.archivePage).not.toHaveBeenCalled();
      expect(fakeClient.createPage).not.toHaveBeenCalled();
      expect(summary.skipped).toBe(1);
    });

    it('met a jour un contenu publie deja synchronise', async () => {
      const published = {
        id: 'c4',
        status: ContentStatus.PUBLISHED,
        notionPageId: 'page-existing',
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      contentRepository.find.mockResolvedValue([published]);

      const summary = await service.pushContent(agency);

      expect(fakeClient.updatePage).toHaveBeenCalledWith(
        'page-existing',
        expect.anything(),
      );
      expect(summary.updated).toBe(1);
    });

    it("utilise la base auto-detectee de l'agence plutot que l'override legacy ou la variable d'env", async () => {
      notionOAuth.resolveDatabaseId.mockResolvedValue('discovered-db-id');
      const scheduled = {
        id: 'c-discovered',
        status: ContentStatus.SCHEDULED,
        notionPageId: null,
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      contentRepository.find.mockResolvedValue([scheduled]);

      await service.pushContent(agency);

      expect(notionOAuth.resolveDatabaseId).toHaveBeenCalledWith(
        agency.id,
        'content',
      );
      expect(fakeClient.createPage).toHaveBeenCalledWith(
        'discovered-db-id',
        expect.anything(),
      );
    });
  });

  describe('pushContent — traitement selon le statut renvoye par Notion', () => {
    it('interrompt le push et arrete les items suivants sur un token invalide (401)', async () => {
      const first = {
        id: 'c1',
        status: ContentStatus.SCHEDULED,
        notionPageId: null,
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      const second = {
        id: 'c2',
        status: ContentStatus.SCHEDULED,
        notionPageId: null,
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      contentRepository.find.mockResolvedValue([first, second]);
      fakeClient.createPage.mockRejectedValue(
        new NotionApiError('token invalide', 'UNAUTHORIZED', 401),
      );

      const summary = await service.pushContent(agency);

      expect(fakeClient.createPage).toHaveBeenCalledTimes(1);
      expect(first.syncStatus).toBe(SyncStatus.ERROR);
      expect(second.syncStatus).toBe(SyncStatus.PENDING);
      expect(summary.errors).toBe(1);
    });

    it('recree une page au prochain push si Notion renvoie 404 sur la page pointee', async () => {
      const stale = {
        id: 'c3',
        status: ContentStatus.SCHEDULED,
        notionPageId: 'page-deleted',
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      contentRepository.find.mockResolvedValue([stale]);
      fakeClient.updatePage.mockRejectedValue(
        new NotionApiError('page introuvable', 'NOT_FOUND', 404),
      );

      const summary = await service.pushContent(agency);

      expect(stale.notionPageId).toBeNull();
      expect(stale.syncStatus).toBe(SyncStatus.PENDING);
      expect(summary.errors).toBe(0);
      expect(summary.skipped).toBe(1);
    });

    it('considere un archivage reussi si la page est deja introuvable (404)', async () => {
      const alreadyGone = {
        id: 'c4',
        status: ContentStatus.DRAFT,
        notionPageId: 'page-already-archived',
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      contentRepository.find.mockResolvedValue([alreadyGone]);
      fakeClient.archivePage.mockRejectedValue(
        new NotionApiError('page introuvable', 'NOT_FOUND', 404),
      );

      const summary = await service.pushContent(agency);

      expect(alreadyGone.notionPageId).toBeNull();
      expect(alreadyGone.syncStatus).toBe(SyncStatus.SYNCED);
      expect(summary.errors).toBe(0);
      expect(summary.updated).toBe(1);
    });

    it("marque toujours l'item en ERROR pour une erreur non speciale (ex: validation)", async () => {
      const invalid = {
        id: 'c5',
        status: ContentStatus.SCHEDULED,
        notionPageId: null,
        syncStatus: SyncStatus.PENDING,
      } as ContentItemEntity;
      contentRepository.find.mockResolvedValue([invalid]);
      fakeClient.createPage.mockRejectedValue(
        new NotionApiError('requete invalide', 'VALIDATION', 400),
      );

      const summary = await service.pushContent(agency);

      expect(invalid.syncStatus).toBe(SyncStatus.ERROR);
      expect(summary.errors).toBe(1);
    });
  });

  describe('pullContent — statut par defaut des pages creees dans Notion', () => {
    it('cree un contenu SCHEDULED quand la page Notion porte une date de publication', async () => {
      fakeClient.queryDatabase.mockResolvedValue({
        pages: [
          {
            id: 'notion-page-1',
            last_edited_time: '2026-07-01T00:00:00.000Z',
            properties: {
              "Nom de l'article": {
                title: [{ plain_text: 'Article planifie' }],
              },
              'Date de publication': { date: { start: '2026-08-01' } },
              Catégorie: { select: { name: 'Blog' } },
            },
          },
        ],
        nextCursor: null,
        hasMore: false,
      });
      const findOne = jest.fn().mockResolvedValue(null);
      const create = jest.fn().mockReturnValue({ agency } as ContentItemEntity);
      Object.assign(contentRepository, { findOne, create });

      const summary = await service.pullContent(agency);

      expect(summary.created).toBe(1);
      const savedEntity = contentRepository.save.mock.calls[0][0];
      expect(savedEntity.status).toBe(ContentStatus.SCHEDULED);
    });

    it('cree un contenu DRAFT quand la page Notion ne porte aucune date', async () => {
      fakeClient.queryDatabase.mockResolvedValue({
        pages: [
          {
            id: 'notion-page-2',
            last_edited_time: '2026-07-01T00:00:00.000Z',
            properties: {
              "Nom de l'article": { title: [{ plain_text: 'Idee brute' }] },
            },
          },
        ],
        nextCursor: null,
        hasMore: false,
      });
      const findOne = jest.fn().mockResolvedValue(null);
      const create = jest.fn().mockReturnValue({ agency } as ContentItemEntity);
      Object.assign(contentRepository, { findOne, create });

      const summary = await service.pullContent(agency);

      expect(summary.created).toBe(1);
      const savedEntity = contentRepository.save.mock.calls[0][0];
      expect(savedEntity.status).toBe(ContentStatus.DRAFT);
    });
  });
});
