import { BadRequestException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ContentStatus } from '../common/enums/content-status.enum';
import { ContentService } from '../content/content.service';
import { ContentIdeaStatus } from './enums/content-idea-status.enum';
import { DuplicateStatus } from './enums/duplicate-status.enum';
import { IdeasService } from './ideas.service';

function createRepositoryMock() {
  return {
    create: jest.fn((value) => value),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (value) => {
      if (Array.isArray(value)) {
        return value.map((item, index) => ({
          id: item.id ?? `saved-${index}`,
          ...item,
        }));
      }

      return {
        id: value.id ?? 'saved',
        ...value,
      };
    }),
  };
}

function createService() {
  const ideasRepository = createRepositoryMock();
  const settingsRepository = createRepositoryMock();
  const runsRepository = createRepositoryMock();
  const contentRepository = createRepositoryMock();
  const curationRepository = createRepositoryMock();
  const aiService = {
    generateTextForAgency: jest.fn(),
  } as unknown as jest.Mocked<Pick<AiService, 'generateTextForAgency'>>;
  const contentService = {
    create: jest.fn(),
  } as unknown as jest.Mocked<Pick<ContentService, 'create'>>;
  const service = new IdeasService(
    ideasRepository as never,
    settingsRepository as never,
    runsRepository as never,
    contentRepository as never,
    curationRepository as never,
    aiService as unknown as AiService,
    contentService as unknown as ContentService,
  );

  return {
    aiService,
    contentRepository,
    contentService,
    curationRepository,
    ideasRepository,
    runsRepository,
    service,
    settingsRepository,
  };
}

describe('IdeasService', () => {
  it('generates ideas, persists them, and scores duplicate risk', async () => {
    const { aiService, contentRepository, ideasRepository, service } =
      createService();
    contentRepository.find.mockResolvedValue([
      {
        id: 'content-1',
        title: 'Guide SEO local pour commercants',
        contentType: 'Article de blog',
        channel: 'Blog',
        tags: ['seo local'],
        notes: null,
      },
    ]);
    aiService.generateTextForAgency.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-test',
      content: JSON.stringify({
        ideas: [
          {
            title: 'Guide SEO local',
            angle: 'Tutoriel pratique',
            contentType: 'Article de blog',
            keywords: ['seo local'],
            searchIntent: 'Informationnelle',
            rationale: 'Sujet proche de la recherche locale.',
          },
        ],
      }),
    });

    const result = await service.generate('agency-1', {
      theme: 'SEO local',
      count: 3,
      checkDuplicates: true,
    });

    expect(result.ideas).toHaveLength(1);
    expect(result.ideas[0]).toMatchObject({
      duplicateStatus: DuplicateStatus.POSSIBLE_DUPLICATE,
      status: ContentIdeaStatus.NEW,
      title: 'Guide SEO local',
    });
    expect(result.ideas[0].similarItems?.[0]).toMatchObject({
      id: 'content-1',
      type: 'CONTENT',
    });
    expect(ideasRepository.save).toHaveBeenCalled();
  });

  it('uses deterministic demo ideas when the demo provider returns text', async () => {
    const { aiService, service } = createService();
    aiService.generateTextForAgency.mockResolvedValue({
      provider: 'demo',
      model: 'demo-local',
      content: 'Reponse generee par le provider demo.',
    });

    const result = await service.generate('agency-1', {
      theme: 'Marketing IA',
      sector: 'SaaS',
      count: 5,
      checkDuplicates: false,
    });

    expect(result.ideas).toHaveLength(5);
    expect(result.ideas[0].title).toContain('Marketing IA');
    expect(result.ideas[0].duplicateStatus).toBe(DuplicateStatus.UNIQUE);
  });

  it('repairs one malformed AI response before persisting ideas', async () => {
    const { aiService, service } = createService();
    aiService.generateTextForAgency
      .mockResolvedValueOnce({
        provider: 'gemini',
        model: 'gemini-test',
        content: '{"ideas":[{"title":"Idée incomplète",}]}',
      })
      .mockResolvedValueOnce({
        provider: 'gemini',
        model: 'gemini-test',
        content: JSON.stringify({
          ideas: [{ title: 'Idée réparée', keywords: ['seo'] }],
        }),
      });

    const result = await service.generate('agency-1', {
      theme: 'SEO',
      count: 3,
      checkDuplicates: false,
    });

    expect(result.ideas).toHaveLength(1);
    expect(result.ideas[0].title).toBe('Idée réparée');
    expect(aiService.generateTextForAgency).toHaveBeenCalledTimes(2);
    expect(aiService.generateTextForAgency).toHaveBeenLastCalledWith(
      'agency-1',
      expect.objectContaining({ responseFormat: 'json', temperature: 0 }),
    );
  });

  it('accepts an idea by creating a content item', async () => {
    const { contentService, ideasRepository, service } = createService();
    ideasRepository.findOne.mockResolvedValue({
      id: 'idea-1',
      title: 'Automatiser son calendrier SEO',
      angle: 'Guide pratique',
      contentType: 'Article de blog',
      keywords: ['seo', 'automatisation'],
      searchIntent: 'Informationnelle',
      rationale: 'Bon sujet pour les equipes marketing.',
      status: ContentIdeaStatus.NEW,
    });
    contentService.create.mockResolvedValue({
      id: 'content-1',
      title: 'Automatiser son calendrier SEO',
    } as never);

    const result = await service.accept('agency-1', 'idea-1');

    expect(contentService.create).toHaveBeenCalledWith(
      'agency-1',
      expect.objectContaining({
        title: 'Automatiser son calendrier SEO',
        status: ContentStatus.IDEA,
        tags: ['seo', 'automatisation'],
      }),
    );
    expect(result.status).toBe(ContentIdeaStatus.ACCEPTED);
    expect(result.acceptedContent).toMatchObject({ id: 'content-1' });
  });

  it('requires a theme before enabling scheduled generation', async () => {
    const { settingsRepository, service } = createService();
    settingsRepository.findOne.mockResolvedValue(null);

    await expect(
      service.updateSettings('agency-1', { enabled: true }),
    ).rejects.toThrow(BadRequestException);
  });
});
