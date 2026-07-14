export type AiMessageRole = 'system' | 'user' | 'assistant';

export type AiMessage = {
  role: AiMessageRole;
  content: string;
};

export type AiJsonSchema = Record<string, unknown>;

export type AiCompletionInput = {
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json';
  responseSchema?: AiJsonSchema;
};

export type AiUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type AiCompletionResult = {
  provider: string;
  model: string;
  content: string;
  usage?: AiUsage;
};

export type AiProviderStatus = {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
  missingConfig?: string[];
};

/**
 * Contract shared by every LLM integration.
 *
 * A provider can target a paid API, a free API, a local model or a test stub.
 * The rest of the application only depends on this interface.
 */
export interface AiProvider {
  readonly id: string;
  readonly label: string;

  complete(input: AiCompletionInput): Promise<AiCompletionResult>;
  getStatus(): AiProviderStatus;
  isConfigured(): boolean;
}
