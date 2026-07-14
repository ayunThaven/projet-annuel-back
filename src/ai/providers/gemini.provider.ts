import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiCompletionInput,
  AiCompletionResult,
  AiMessage,
  AiProvider,
  AiProviderStatus,
} from './ai-provider.interface';

type GeminiContent = {
  role?: 'user' | 'model';
  parts: Array<{ text: string }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

/**
 * Provider for the Gemini GenerateContent REST API.
 *
 * It keeps the application vendor-specific code in one place while preserving
 * the generic `AiProvider` contract used by the rest of the backend.
 */
@Injectable()
export class GeminiProvider implements AiProvider {
  readonly id = 'gemini';
  readonly label = 'Google Gemini';

  constructor(private readonly configService: ConfigService) {}

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    const missingConfig = this.getMissingConfig(input.apiKey);

    if (missingConfig.length > 0) {
      throw new BadRequestException(
        `AI provider ${this.id} is not configured: ${missingConfig.join(', ')}`,
      );
    }

    const model = input.model?.trim() || this.getDefaultModel();
    const timeoutMs = this.getTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.createUrl(model, input.apiKey), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.createPayload(input)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await this.readErrorDetails(response);
        throw new BadGatewayException(
          `AI provider ${this.id} returned ${response.status}${details}`,
        );
      }

      const body = (await response.json()) as GeminiResponse;
      const content = this.extractContent(body);

      if (!content) {
        throw new BadGatewayException(
          `AI provider ${this.id} returned an empty completion`,
        );
      }

      return {
        provider: this.id,
        model,
        content,
        usage: {
          promptTokens: body.usageMetadata?.promptTokenCount,
          completionTokens: body.usageMetadata?.candidatesTokenCount,
          totalTokens: body.usageMetadata?.totalTokenCount,
        },
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException(
          `AI provider ${this.id} timed out after ${timeoutMs}ms`,
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  getStatus(): AiProviderStatus {
    const missingConfig = this.getMissingConfig();

    return {
      id: this.id,
      label: this.label,
      configured: missingConfig.length === 0,
      defaultModel: this.getDefaultModel(),
      ...(missingConfig.length > 0 ? { missingConfig } : {}),
    };
  }

  isConfigured() {
    return this.getMissingConfig().length === 0;
  }

  private createPayload(input: AiCompletionInput) {
    const systemInstruction = this.createSystemInstruction(input.messages);
    const contents = this.createContents(input.messages);

    if (contents.length === 0) {
      throw new BadRequestException(
        'At least one user or assistant message is required',
      );
    }

    return {
      ...(systemInstruction ? { systemInstruction } : {}),
      contents,
      generationConfig: {
        ...(input.temperature !== undefined
          ? { temperature: input.temperature }
          : {}),
        ...(input.maxTokens !== undefined
          ? { maxOutputTokens: input.maxTokens }
          : {}),
        ...(input.responseFormat === 'json'
          ? {
              responseFormat: {
                text: {
                  mimeType: 'APPLICATION_JSON',
                  ...(input.responseSchema
                    ? { schema: input.responseSchema }
                    : {}),
                },
              },
            }
          : {}),
      },
    };
  }

  private createSystemInstruction(messages: AiMessage[]) {
    const text = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.trim())
      .filter(Boolean)
      .join('\n\n');

    return text ? { parts: [{ text }] } : undefined;
  }

  private createContents(messages: AiMessage[]): GeminiContent[] {
    return messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));
  }

  private createUrl(model: string, apiKey?: string) {
    const url = new URL(
      `${this.getBaseUrl()}/${this.normalizeModelResource(model)}:generateContent`,
    );
    url.searchParams.set('key', this.getApiKey(apiKey) ?? '');

    return url;
  }

  private extractContent(body: GeminiResponse) {
    return body.candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  private getBaseUrl() {
    return (
      this.normalizeBaseUrl(
        this.configService.get<string>('GEMINI_BASE_URL'),
      ) || 'https://generativelanguage.googleapis.com/v1beta'
    );
  }

  private getApiKey(apiKey?: string) {
    return (
      apiKey?.trim() || this.configService.get<string>('GEMINI_API_KEY')?.trim()
    );
  }

  private getDefaultModel() {
    return (
      this.configService.get<string>('GEMINI_MODEL')?.trim() ||
      'gemini-2.0-flash'
    );
  }

  private getTimeoutMs() {
    const rawValue =
      this.configService.get<string>('GEMINI_TIMEOUT_MS') ??
      this.configService.get<string>('AI_TIMEOUT_MS');
    const parsedValue = Number(rawValue);

    return Number.isFinite(parsedValue) && parsedValue > 0
      ? parsedValue
      : 30000;
  }

  private getMissingConfig(apiKey?: string) {
    return [!this.getApiKey(apiKey) ? 'GEMINI_API_KEY' : undefined].filter(
      (value): value is string => Boolean(value),
    );
  }

  private normalizeBaseUrl(value?: string) {
    return value?.trim().replace(/\/+$/, '');
  }

  private normalizeModelResource(model: string) {
    const normalized = model.trim().replace(/^\/+/, '');

    if (normalized.includes('/')) {
      return normalized;
    }

    return `models/${normalized}`;
  }

  private async readErrorDetails(response: Response) {
    const text = await response.text();
    const normalized = text.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return '';
    }

    return `: ${normalized.slice(0, 300)}`;
  }
}
