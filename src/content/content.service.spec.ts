import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { ContentStatus } from '../common/enums/content-status.enum';
import { SyncStatus } from '../common/enums/sync-status.enum';
import { NotionSyncService } from '../notion/notion-sync.service';
import { ContentService } from './content.service';
import { ContentItemEntity } from './entities/content-item.entity';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('ContentService — declenchement Notion', () => {
  let service: ContentService;
  let contentRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let agenciesRepository: { findOne: jest.Mock };
  let notionSync: { pushContent: jest.Mock };

  const agency = { id: 'agency-1' } as AgencyEntity;

  beforeEach(async () => {
    contentRepository = {
      create: jest.fn().mockImplementation((input) => ({ ...input })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
    };
    agenciesRepository = { findOne: jest.fn().mockResolvedValue(agency) };
    notionSync = { pushContent: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        {
          provide: getRepositoryToken(ContentItemEntity),
          useValue: contentRepository,
        },
        {
          provide: getRepositoryToken(AgencyEntity),
          useValue: agenciesRepository,
        },
        { provide: NotionSyncService, useValue: notionSync },
      ],
    }).compile();

    service = module.get(ContentService);
  });

  it('declenche un push Notion a la creation directe en SCHEDULED', async () => {
    await service.create('agency-1', {
      title: 'Article',
      status: ContentStatus.SCHEDULED,
      publicationDate: '2026-08-01',
    } as never);
    await flushPromises();

    expect(agenciesRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'agency-1' },
    });
    expect(notionSync.pushContent).toHaveBeenCalledWith(agency);
  });

  it('ne declenche aucun push a la creation en brouillon', async () => {
    await service.create('agency-1', {
      title: 'Idee',
      status: ContentStatus.IDEA,
    } as never);
    await flushPromises();

    expect(notionSync.pushContent).not.toHaveBeenCalled();
  });

  it('declenche un push quand un contenu passe de DRAFT a SCHEDULED', async () => {
    contentRepository.findOne.mockResolvedValue({
      id: 'c1',
      status: ContentStatus.DRAFT,
      syncStatus: SyncStatus.SYNCED,
    } as ContentItemEntity);

    await service.update('agency-1', 'c1', {
      status: ContentStatus.SCHEDULED,
      publicationDate: '2026-08-01',
    } as never);
    await flushPromises();

    expect(notionSync.pushContent).toHaveBeenCalledWith(agency);
  });

  it('declenche un push (pour archivage) quand un contenu quitte SCHEDULED', async () => {
    contentRepository.findOne.mockResolvedValue({
      id: 'c2',
      status: ContentStatus.SCHEDULED,
      syncStatus: SyncStatus.SYNCED,
      notionPageId: 'page-1',
    } as ContentItemEntity);

    await service.update('agency-1', 'c2', {
      status: ContentStatus.DRAFT,
    } as never);
    await flushPromises();

    expect(notionSync.pushContent).toHaveBeenCalledWith(agency);
  });

  it('ne declenche aucun push pour une modification qui reste hors calendrier', async () => {
    contentRepository.findOne.mockResolvedValue({
      id: 'c3',
      status: ContentStatus.DRAFT,
      syncStatus: SyncStatus.SYNCED,
    } as ContentItemEntity);

    await service.update('agency-1', 'c3', { title: 'Nouveau titre' } as never);
    await flushPromises();

    expect(notionSync.pushContent).not.toHaveBeenCalled();
  });

  it('journalise et absorbe une erreur de push sans faire echouer la mise a jour', async () => {
    contentRepository.findOne.mockResolvedValue({
      id: 'c4',
      status: ContentStatus.DRAFT,
      syncStatus: SyncStatus.SYNCED,
    } as ContentItemEntity);
    notionSync.pushContent.mockRejectedValue(new Error('Notion down'));

    await expect(
      service.update('agency-1', 'c4', {
        status: ContentStatus.SCHEDULED,
        publicationDate: '2026-08-01',
      } as never),
    ).resolves.toBeDefined();
    await flushPromises();

    expect(notionSync.pushContent).toHaveBeenCalled();
  });
});
