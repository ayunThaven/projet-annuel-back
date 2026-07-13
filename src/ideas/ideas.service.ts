import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { AiService } from '../ai/ai.service';
import { ContentStatus } from '../common/enums/content-status.enum';
import { ContentService } from '../content/content.service';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { CurationItemEntity } from '../curation/entities/curation-item.entity';
import { GenerateContentIdeasDto } from './dto/generate-content-ideas.dto';
import { UpdateContentIdeaDto } from './dto/update-content-idea.dto';
import { UpdateIdeaGenerationSettingsDto } from './dto/update-idea-generation-settings.dto';
import { ContentIdeaEntity } from './entities/content-idea.entity';
import { IdeaGenerationRunEntity } from './entities/idea-generation-run.entity';
import { IdeaGenerationSettingsEntity } from './entities/idea-generation-settings.entity';
import { ContentIdeaSource } from './enums/content-idea-source.enum';
import { ContentIdeaStatus } from './enums/content-idea-status.enum';
import { DuplicateStatus } from './enums/duplicate-status.enum';
import { IdeaGenerationCadence } from './enums/idea-generation-cadence.enum';
import { IdeaGenerationRunStatus } from './enums/idea-generation-run-status.enum';
import { calculateNextIdeaRunAt } from './idea-generation-schedule';
import { GeneratedIdeaPayload, SimilarIdeaItem } from './types';

type IdeaGenerationParams = {
  theme: string;
  sector?: string | null;
  count: number;
  checkDuplicates: boolean;
};

type DuplicateCorpusItem = {
  id: string;
  type: SimilarIdeaItem['type'];
  title: string;
  text: string;
};

const STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'avec',
  'ce',
  'ces',
  'comment',
  'dans',
  'de',
  'des',
  'du',
  'en',
  'et',
  'la',
  'le',
  'les',
  'leur',
  'leurs',
  'pour',
  'que',
  'qui',
  'sur',
  'un',
  'une',
  'vos',
  'votre',
]);

@Injectable()
export class IdeasService {
  constructor(
    @InjectRepository(ContentIdeaEntity)
    private readonly ideasRepository: Repository<ContentIdeaEntity>,
    @InjectRepository(IdeaGenerationSettingsEntity)
    private readonly settingsRepository: Repository<IdeaGenerationSettingsEntity>,
    @InjectRepository(IdeaGenerationRunEntity)
    private readonly runsRepository: Repository<IdeaGenerationRunEntity>,
    @InjectRepository(ContentItemEntity)
    private readonly contentRepository: Repository<ContentItemEntity>,
    @InjectRepository(CurationItemEntity)
    private readonly curationRepository: Repository<CurationItemEntity>,
    private readonly aiService: AiService,
    private readonly contentService: ContentService,
  ) {}

  findAll(agencyId: string) {
    return this.ideasRepository.find({
      where: { agency: { id: agencyId } },
      relations: { acceptedContent: true },
      order: { createdAt: 'DESC' },
    });
  }

  async generate(
    agencyId: string,
    input: GenerateContentIdeasDto,
    source: ContentIdeaSource = ContentIdeaSource.MANUAL,
  ) {
    return this.generateForAgency(agencyId, {
      theme: input.theme.trim(),
      sector: input.sector?.trim() || null,
      count: input.count ?? 3,
      checkDuplicates: input.checkDuplicates ?? true,
    }, source);
  }

  async update(agencyId: string, id: string, input: UpdateContentIdeaDto) {
    const idea = await this.findOne(agencyId, id);

    if (input.status === ContentIdeaStatus.ACCEPTED) {
      throw new BadRequestException('Use the accept endpoint to accept an idea');
    }

    if (input.status !== undefined) {
      idea.status = input.status;
    }

    return this.ideasRepository.save(idea);
  }

  async accept(agencyId: string, id: string) {
    const idea = await this.findOne(agencyId, id);

    if (idea.status !== ContentIdeaStatus.NEW) {
      throw new BadRequestException('Only new ideas can be accepted');
    }

    const content = await this.contentService.create(agencyId, {
      title: idea.title,
      status: ContentStatus.IDEA,
      contentType: idea.contentType ?? undefined,
      tags: idea.keywords ?? undefined,
      notes: [
        idea.angle ? `Angle: ${idea.angle}` : undefined,
        idea.searchIntent ? `Intention SEO: ${idea.searchIntent}` : undefined,
        idea.rationale ? `Pourquoi cette idee: ${idea.rationale}` : undefined,
      ]
        .filter((value): value is string => Boolean(value))
        .join('\n'),
    });

    idea.status = ContentIdeaStatus.ACCEPTED;
    idea.acceptedContent = content;

    return this.ideasRepository.save(idea);
  }

  async getSettings(agencyId: string) {
    return this.getOrCreateSettings(agencyId);
  }

  async updateSettings(
    agencyId: string,
    input: UpdateIdeaGenerationSettingsDto,
  ) {
    const settings = await this.getOrCreateSettings(agencyId);

    if (input.enabled !== undefined) settings.enabled = input.enabled;
    if (input.cadence !== undefined) settings.cadence = input.cadence;
    if (input.timeOfDay !== undefined) settings.timeOfDay = input.timeOfDay;
    if (input.weekday !== undefined) settings.weekday = input.weekday;
    if (input.timezone !== undefined) {
      settings.timezone = input.timezone.trim() || 'Europe/Paris';
    }
    if (input.theme !== undefined) settings.theme = input.theme?.trim() || null;
    if (input.sector !== undefined) {
      settings.sector = input.sector?.trim() || null;
    }
    if (input.count !== undefined) settings.count = input.count;
    if (input.checkDuplicates !== undefined) {
      settings.checkDuplicates = input.checkDuplicates;
    }

    if (!settings.weekday) {
      settings.weekday = 1;
    }

    if (settings.enabled && !settings.theme?.trim()) {
      throw new BadRequestException(
        'A theme is required to enable scheduled idea generation',
      );
    }

    settings.nextRunAt = settings.enabled
      ? calculateNextIdeaRunAt(settings)
      : null;

    return this.settingsRepository.save(settings);
  }

  async generateFromSettings(settings: IdeaGenerationSettingsEntity) {
    if (!settings.enabled || !settings.theme?.trim()) {
      return null;
    }

    return this.generateForAgency(
      settings.agency.id,
      {
        theme: settings.theme,
        sector: settings.sector,
        count: settings.count,
        checkDuplicates: settings.checkDuplicates,
      },
      ContentIdeaSource.SCHEDULED,
      {
        cadence: settings.cadence,
        timeOfDay: settings.timeOfDay,
        weekday: settings.weekday,
        timezone: settings.timezone,
      },
    );
  }

  private async generateForAgency(
    agencyId: string,
    params: IdeaGenerationParams,
    source: ContentIdeaSource,
    scheduleSnapshot: Record<string, unknown> = {},
  ) {
    if (!params.theme.trim()) {
      throw new BadRequestException('Theme is required');
    }

    const snapshot = {
      ...params,
      ...scheduleSnapshot,
    };

    try {
      const corpus = await this.buildDuplicateCorpus(agencyId);
      const result = await this.aiService.generateText({
        prompt: this.buildPrompt(params),
        context: this.buildAiContext(corpus),
        temperature: 0.45,
        maxTokens: Math.max(900, params.count * 450),
      });
      const generatedIdeas = this.parseGeneratedIdeas(
        result.content,
        params,
        result.provider,
      ).slice(0, params.count);

      if (generatedIdeas.length === 0) {
        throw new InternalServerErrorException('No ideas were generated');
      }

      const ideas = generatedIdeas.map((idea) => {
        const duplicate = params.checkDuplicates
          ? this.scoreDuplicates(idea, corpus)
          : {
              score: 0,
              status: DuplicateStatus.UNIQUE,
              similarItems: [] as SimilarIdeaItem[],
            };

        return this.ideasRepository.create({
          agency: { id: agencyId } as AgencyEntity,
          title: idea.title,
          angle: idea.angle,
          contentType: idea.contentType,
          keywords: idea.keywords,
          searchIntent: idea.searchIntent,
          rationale: idea.rationale,
          duplicateScore: duplicate.score,
          duplicateStatus: duplicate.status,
          similarItems: duplicate.similarItems,
          source,
          status: ContentIdeaStatus.NEW,
        });
      });
      const savedIdeas = await this.ideasRepository.save(ideas);
      const run = await this.runsRepository.save(
        this.runsRepository.create({
          agency: { id: agencyId } as AgencyEntity,
          source,
          status: IdeaGenerationRunStatus.SUCCESS,
          settingsSnapshot: snapshot,
          generatedCount: savedIdeas.length,
          errorMessage: null,
          completedAt: new Date(),
        }),
      );

      return {
        ideas: savedIdeas,
        run,
      };
    } catch (error) {
      await this.runsRepository.save(
        this.runsRepository.create({
          agency: { id: agencyId } as AgencyEntity,
          source,
          status: IdeaGenerationRunStatus.ERROR,
          settingsSnapshot: snapshot,
          generatedCount: 0,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown generation error',
          completedAt: new Date(),
        }),
      );

      throw error;
    }
  }

  private async findOne(agencyId: string, id: string) {
    const idea = await this.ideasRepository.findOne({
      where: { id, agency: { id: agencyId } },
      relations: { acceptedContent: true },
    });

    if (!idea) {
      throw new NotFoundException('Content idea not found');
    }

    return idea;
  }

  private async getOrCreateSettings(agencyId: string) {
    const existing = await this.settingsRepository.findOne({
      where: { agency: { id: agencyId } },
      relations: { agency: true },
    });

    if (existing) {
      return existing;
    }

    return this.settingsRepository.save(
      this.settingsRepository.create({
        agency: { id: agencyId } as AgencyEntity,
        enabled: false,
        cadence: IdeaGenerationCadence.DAILY,
        timeOfDay: '09:00',
        weekday: 1,
        timezone: 'Europe/Paris',
        theme: null,
        sector: null,
        count: 3,
        checkDuplicates: true,
        nextRunAt: null,
        lastRunAt: null,
      }),
    );
  }

  private buildPrompt(params: IdeaGenerationParams) {
    return [
      'Genere des idees de contenu SEO en francais.',
      `Theme principal: ${params.theme}.`,
      params.sector ? `Secteur: ${params.sector}.` : undefined,
      `Nombre exact d'idees: ${params.count}.`,
      'Retourne uniquement un JSON valide, sans markdown.',
      'Format attendu: {"ideas":[{"title":"...","angle":"...","contentType":"Article de blog","keywords":["..."],"searchIntent":"Informationnelle","rationale":"..."}]}',
      'Chaque idee doit etre actionnable, non generique et differente des contenus existants.',
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n');
  }

  private buildAiContext(corpus: DuplicateCorpusItem[]) {
    if (corpus.length === 0) {
      return 'Aucun historique editorial disponible pour cette agence.';
    }

    return [
      'Historique editorial et veille a eviter ou a utiliser comme contexte:',
      ...corpus.slice(0, 45).map((item) => {
        return `- [${item.type}] ${item.title}: ${item.text.slice(0, 220)}`;
      }),
    ].join('\n');
  }

  private parseGeneratedIdeas(
    content: string,
    params: IdeaGenerationParams,
    provider: string,
  ): GeneratedIdeaPayload[] {
    try {
      const parsed = JSON.parse(this.extractJson(content)) as unknown;
      const rawIdeas = Array.isArray(parsed)
        ? parsed
        : this.readRecord(parsed).ideas;

      if (!Array.isArray(rawIdeas)) {
        throw new Error('Missing ideas array');
      }

      return rawIdeas
        .map((idea) => this.normalizeIdea(idea))
        .filter((idea): idea is GeneratedIdeaPayload => Boolean(idea));
    } catch (error) {
      if (provider === 'demo') {
        return this.createDemoIdeas(params);
      }

      throw new InternalServerErrorException(
        `AI response could not be parsed as content ideas: ${
          error instanceof Error ? error.message : 'invalid JSON'
        }`,
      );
    }
  }

  private extractJson(content: string) {
    const withoutFence = content
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();

    if (withoutFence.startsWith('{') || withoutFence.startsWith('[')) {
      return withoutFence;
    }

    const objectStart = withoutFence.indexOf('{');
    const objectEnd = withoutFence.lastIndexOf('}');

    if (objectStart >= 0 && objectEnd > objectStart) {
      return withoutFence.slice(objectStart, objectEnd + 1);
    }

    const arrayStart = withoutFence.indexOf('[');
    const arrayEnd = withoutFence.lastIndexOf(']');

    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return withoutFence.slice(arrayStart, arrayEnd + 1);
    }

    throw new Error('No JSON object found');
  }

  private normalizeIdea(value: unknown): GeneratedIdeaPayload | null {
    const idea = this.readRecord(value);
    const title = this.readString(idea.title, 200);

    if (!title) {
      return null;
    }

    return {
      title,
      angle: this.readString(idea.angle, 120) || 'Angle pratique',
      contentType:
        this.readString(idea.contentType, 120) || 'Article de blog',
      keywords: this.readStringArray(idea.keywords, 8),
      searchIntent:
        this.readString(idea.searchIntent, 160) || 'Informationnelle',
      rationale:
        this.readString(idea.rationale, 600) ||
        'Idee pertinente pour enrichir le calendrier editorial.',
    };
  }

  private readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private readString(value: unknown, maxLength: number) {
    return typeof value === 'string'
      ? value.trim().slice(0, maxLength)
      : '';
  }

  private readStringArray(value: unknown, limit: number) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.readString(item, 60))
      .filter(Boolean)
      .slice(0, limit);
  }

  private createDemoIdeas(params: IdeaGenerationParams): GeneratedIdeaPayload[] {
    return Array.from({ length: params.count }, (_, index) => ({
      title: `${params.theme}: idee SEO ${index + 1}`,
      angle:
        index % 2 === 0
          ? 'Guide pratique'
          : 'Analyse strategique',
      contentType: index % 3 === 0 ? 'Post LinkedIn' : 'Article de blog',
      keywords: [params.theme, params.sector ?? 'SEO'].filter(Boolean),
      searchIntent: 'Informationnelle',
      rationale:
        'Proposition locale generee en mode demo pour tester le workflow.',
    }));
  }

  private async buildDuplicateCorpus(
    agencyId: string,
  ): Promise<DuplicateCorpusItem[]> {
    const [contents, curationItems, ideas] = await Promise.all([
      this.contentRepository.find({
        where: { agency: { id: agencyId } },
        order: { createdAt: 'DESC' },
        take: 40,
      }),
      this.curationRepository.find({
        where: { agency: { id: agencyId } },
        order: { createdAt: 'DESC' },
        take: 40,
      }),
      this.ideasRepository.find({
        where: {
          agency: { id: agencyId },
          status: In([ContentIdeaStatus.NEW, ContentIdeaStatus.ACCEPTED]),
        },
        order: { createdAt: 'DESC' },
        take: 40,
      }),
    ]);

    return [
      ...contents.map((item) => ({
        id: item.id,
        type: 'CONTENT' as const,
        title: item.title,
        text: [
          item.title,
          item.contentType,
          item.channel,
          item.tags?.join(' '),
          item.notes,
        ]
          .filter(Boolean)
          .join(' '),
      })),
      ...curationItems.map((item) => ({
        id: item.id,
        type: 'CURATION' as const,
        title: item.title,
        text: [
          item.title,
          item.source,
          item.topics?.join(' '),
          item.notes,
        ]
          .filter(Boolean)
          .join(' '),
      })),
      ...ideas.map((item) => ({
        id: item.id,
        type: 'IDEA' as const,
        title: item.title,
        text: [
          item.title,
          item.angle,
          item.contentType,
          item.keywords?.join(' '),
          item.searchIntent,
          item.rationale,
        ]
          .filter(Boolean)
          .join(' '),
      })),
    ];
  }

  private scoreDuplicates(
    idea: GeneratedIdeaPayload,
    corpus: DuplicateCorpusItem[],
  ) {
    const ideaTokens = this.tokenize(
      [idea.title, idea.angle, idea.keywords.join(' ')].join(' '),
    );
    const similarItems = corpus
      .map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        score: this.roundScore(
          this.jaccard(ideaTokens, this.tokenize(item.text)),
        ),
      }))
      .filter((item) => item.score >= 0.18)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
    const score = similarItems[0]?.score ?? 0;

    return {
      score,
      status:
        score >= 0.65
          ? DuplicateStatus.DUPLICATE
          : score >= 0.35
            ? DuplicateStatus.POSSIBLE_DUPLICATE
            : DuplicateStatus.UNIQUE,
      similarItems,
    };
  }

  private tokenize(value: string): Set<string> {
    return new Set(
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
    );
  }

  private jaccard(left: Set<string>, right: Set<string>) {
    if (left.size === 0 || right.size === 0) {
      return 0;
    }

    let intersection = 0;

    left.forEach((token) => {
      if (right.has(token)) intersection += 1;
    });

    return intersection / (left.size + right.size - intersection);
  }

  private roundScore(value: number) {
    return Math.round(value * 100) / 100;
  }
}
