import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { DemoAiProvider } from './providers/demo-ai.provider';
import { GeminiProvider } from './providers/gemini.provider';

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('AiService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses Gemini as the default provider', () => {
    const config = createConfig({
      GEMINI_API_KEY: 'secret',
      GEMINI_MODEL: 'gemini-test',
    });
    const service = new AiService(
      config,
      new DemoAiProvider(config),
      new GeminiProvider(config),
    );

    expect(service.listProviders()).toMatchObject({
      defaultProvider: 'gemini',
    });
  });

  it('can explicitly use the demo provider', async () => {
    const config = createConfig({
      AI_PROVIDER: 'demo',
    });
    const service = new AiService(
      config,
      new DemoAiProvider(config),
      new GeminiProvider(config),
    );

    const response = await service.generateText({
      prompt: 'Ecris une idee de contenu SEO',
    });

    expect(response.provider).toBe('demo');
    expect(response.content).toContain('provider demo');
  });

  it('adds the SEO Genius system context and runtime context before calling Gemini', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'Article SEO pret a utiliser' }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;
    const config = createConfig({
      GEMINI_API_KEY: 'secret',
      GEMINI_MODEL: 'gemini-test',
      AI_APP_CONTEXT: 'Contexte global de test.',
    });
    const service = new AiService(
      config,
      new DemoAiProvider(config),
      new GeminiProvider(config),
    );

    await service.generateText({
      prompt: 'Redige une introduction.',
      systemPrompt: 'Utilise un ton expert mais accessible.',
      context: 'Mot-cle principal: automatisation SEO.',
    });

    const [, requestOptions] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestOptions.body);
    const systemText = body.systemInstruction.parts[0].text;

    expect(systemText).toContain('SEO Genius');
    expect(systemText).toContain('hors sujet');
    expect(systemText).toContain('Contexte global de test.');
    expect(systemText).toContain('Mot-cle principal: automatisation SEO.');
    expect(systemText).toContain('Utilise un ton expert mais accessible.');
    expect(body.contents).toEqual([
      {
        role: 'user',
        parts: [{ text: 'Redige une introduction.' }],
      },
    ]);
  });

  it('lists providers without leaking secrets', () => {
    const config = createConfig({
      GEMINI_API_KEY: 'secret',
      GEMINI_MODEL: 'custom-gemini-model',
    });
    const service = new AiService(
      config,
      new DemoAiProvider(config),
      new GeminiProvider(config),
    );

    expect(service.listProviders()).toEqual({
      defaultProvider: 'gemini',
      providers: [
        {
          id: 'demo',
          label: 'Demo local',
          configured: true,
          defaultModel: 'demo-local',
        },
        {
          id: 'gemini',
          label: 'Google Gemini',
          configured: true,
          defaultModel: 'custom-gemini-model',
        },
      ],
    });
  });

  it('rejects unknown providers', async () => {
    const config = createConfig();
    const service = new AiService(
      config,
      new DemoAiProvider(config),
      new GeminiProvider(config),
    );

    expect(() =>
      service.generateText({
        provider: 'missing',
        prompt: 'Hello',
      }),
    ).toThrow(BadRequestException);
  });
});
