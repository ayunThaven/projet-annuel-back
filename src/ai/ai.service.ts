import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatCompletionDto } from './dto/chat-completion.dto';
import { GenerateTextDto } from './dto/generate-text.dto';
import {
  formatRuntimeContext,
  SEO_AI_SYSTEM_CONTEXT,
} from './prompts/seo-ai-context';
import { DemoAiProvider } from './providers/demo-ai.provider';
import {
  AiCompletionInput,
  AiJsonSchema,
  AiMessage,
  AiProvider,
} from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';

/**
 * Facade used by application modules to call a language model.
 *
 * Provider selection stays here so future business modules do not depend on a
 * specific external AI SDK or vendor.
 */
@Injectable()
export class AiService {
  private readonly providers = new Map<string, AiProvider>();

  constructor(
    private readonly configService: ConfigService,
    demoAiProvider: DemoAiProvider,
    geminiProvider: GeminiProvider,
  ) {
    [demoAiProvider, geminiProvider].forEach((provider) => {
      this.providers.set(provider.id, provider);
    });
  }

  listProviders() {
    return {
      defaultProvider: this.getDefaultProviderId(),
      providers: Array.from(this.providers.values()).map((provider) =>
        provider.getStatus(),
      ),
    };
  }

  complete(input: ChatCompletionDto) {
    return this.callProvider({
      provider: input.provider,
      messages: this.withApplicationContext(input.messages, input.context),
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
  }

  generateText(input: GenerateTextDto & { responseSchema?: AiJsonSchema }) {
    const messages: AiMessage[] = [
      ...(input.systemPrompt
        ? [{ role: 'system' as const, content: input.systemPrompt }]
        : []),
      { role: 'user' as const, content: input.prompt },
    ];

    return this.callProvider({
      provider: input.provider,
      messages: this.withApplicationContext(messages, input.context),
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      responseFormat: input.responseFormat,
      responseSchema: input.responseSchema,
    });
  }

  private callProvider(input: AiCompletionInput & { provider?: string }) {
    const provider = this.resolveProvider(input.provider);

    return provider.complete({
      messages: input.messages,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      responseFormat: input.responseFormat,
      responseSchema: input.responseSchema,
    });
  }

  private withApplicationContext(messages: AiMessage[], context?: string) {
    return [
      {
        role: 'system' as const,
        content: this.buildSystemContext(context),
      },
      ...messages,
    ];
  }

  private buildSystemContext(context?: string) {
    const globalContext = this.configService
      .get<string>('AI_APP_CONTEXT')
      ?.trim();

    return [
      SEO_AI_SYSTEM_CONTEXT,
      globalContext ? formatRuntimeContext(globalContext) : undefined,
      context?.trim() ? formatRuntimeContext(context) : undefined,
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n\n');
  }

  private resolveProvider(providerId?: string) {
    const resolvedProviderId = (
      providerId || this.getDefaultProviderId()
    ).trim();
    const provider = this.providers.get(resolvedProviderId);

    if (!provider) {
      throw new BadRequestException(
        `Unknown AI provider "${resolvedProviderId}". Available providers: ${Array.from(
          this.providers.keys(),
        ).join(', ')}`,
      );
    }

    if (!provider.isConfigured()) {
      throw new BadRequestException(
        `AI provider "${resolvedProviderId}" is not configured`,
      );
    }

    return provider;
  }

  private getDefaultProviderId() {
    return this.configService.get<string>('AI_PROVIDER')?.trim() || 'gemini';
  }
}
