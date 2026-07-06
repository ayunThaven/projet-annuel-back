import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiCompletionInput,
  AiCompletionResult,
  AiProvider,
  AiProviderStatus,
} from './ai-provider.interface';

/**
 * Local provider used when no external LLM key is configured.
 *
 * It keeps the API usable in development and in automated tests without
 * making network calls.
 */
@Injectable()
export class DemoAiProvider implements AiProvider {
  readonly id = 'demo';
  readonly label = 'Demo local';

  constructor(private readonly configService: ConfigService) {}

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    const model = input.model?.trim() || this.getDefaultModel();
    const lastUserMessage =
      input.messages
        .slice()
        .reverse()
        .find((message) => message.role === 'user')?.content ?? '';

    return {
      provider: this.id,
      model,
      content: [
        'Reponse generee par le provider demo.',
        '',
        `Sujet detecte: ${this.summarize(lastUserMessage)}`,
        '',
        'Configure AI_PROVIDER=gemini avec GEMINI_API_KEY pour appeler le modele par defaut de l application.',
      ].join('\n'),
      usage: {
        promptTokens: this.estimateTokens(
          input.messages.map((message) => message.content).join(' '),
        ),
        completionTokens: 42,
      },
    };
  }

  getStatus(): AiProviderStatus {
    return {
      id: this.id,
      label: this.label,
      configured: true,
      defaultModel: this.getDefaultModel(),
    };
  }

  isConfigured() {
    return true;
  }

  private getDefaultModel() {
    return (
      this.configService.get<string>('AI_DEMO_MODEL')?.trim() || 'demo-local'
    );
  }

  private summarize(value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return 'aucun prompt utilisateur fourni';
    }

    return normalized.length > 160
      ? `${normalized.slice(0, 157)}...`
      : normalized;
  }

  private estimateTokens(value: string) {
    return Math.max(1, Math.ceil(value.length / 4));
  }
}
