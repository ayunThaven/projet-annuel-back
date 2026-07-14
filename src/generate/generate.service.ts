import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { AiService } from '../ai/ai.service';
import { ContentStatus } from '../common/enums/content-status.enum';
import { SyncStatus } from '../common/enums/sync-status.enum';
import { ContentItemEntity } from '../content/entities/content-item.entity';
import { GenerateContentDto } from './dto/generate-content.dto';

@Injectable()
export class GenerateService {
  constructor(
    @InjectRepository(ContentItemEntity)
    private readonly contentRepository: Repository<ContentItemEntity>,
    private readonly aiService: AiService,
  ) {}

  async generateContent(agencyId: string, input: GenerateContentDto) {
    const aiResult = await this.aiService.generateTextForAgency(agencyId, {
      prompt: this.buildGenerationPrompt(input),
      systemPrompt:
        'Tu es un redacteur SEO senior. Genere un contenu exploitable, structure et pret a adapter dans SEO Genius.',
      context: this.buildGenerationContext(input),
      provider: input.provider,
      model: input.model,
      temperature: input.temperature ?? 0.7,
      maxTokens: input.maxTokens ?? 3000,
    });

    const item = input.saveDraft
      ? await this.contentRepository.save(
          this.contentRepository.create({
            agency: { id: agencyId } as AgencyEntity,
            title: input.title.trim(),
            status: ContentStatus.DRAFT,
            channel: input.channel ?? null,
            contentType: input.contentType ?? null,
            tags: input.keywords ?? null,
            notes: input.brief ?? null,
            body: aiResult.content,
            syncStatus: SyncStatus.PENDING,
          }),
        )
      : undefined;

    return {
      content: aiResult.content,
      item,
      ai: {
        provider: aiResult.provider,
        model: aiResult.model,
        usage: aiResult.usage,
      },
    };
  }

  private buildGenerationPrompt(input: GenerateContentDto) {
    return [
      `Titre / sujet: ${input.title.trim()}`,
      input.contentType ? `Type de contenu: ${input.contentType}` : undefined,
      input.channel ? `Canal: ${input.channel}` : undefined,
      input.targetAudience
        ? `Audience cible: ${input.targetAudience}`
        : undefined,
      input.tone ? `Ton: ${input.tone}` : undefined,
      `Langue: ${input.language?.trim() || 'francais'}`,
      input.keywords?.length
        ? `Mots-cles a integrer: ${input.keywords.join(', ')}`
        : undefined,
      input.outline?.length
        ? `Plan souhaite:\n${input.outline.map((item) => `- ${item}`).join('\n')}`
        : undefined,
      input.callToAction
        ? `Appel a l'action: ${input.callToAction}`
        : undefined,
      input.constraints ? `Contraintes: ${input.constraints}` : undefined,
      '',
      'Redige le contenu complet avec des titres clairs, des paragraphes courts et une structure SEO coherente.',
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');
  }

  private buildGenerationContext(input: GenerateContentDto) {
    return [
      'Contexte de generation de contenu editorial.',
      input.brief ? `Brief: ${input.brief}` : undefined,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');
  }
}
