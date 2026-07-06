import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('GeminiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('maps generic chat input to the Gemini GenerateContent API', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'Idee SEO generee' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock;
    const provider = new GeminiProvider(
      createConfig({
        GEMINI_API_KEY: 'secret',
        GEMINI_MODEL: 'gemini-test',
        GEMINI_BASE_URL: 'https://example.test/v1beta/',
      }),
    );

    const response = await provider.complete({
      messages: [
        { role: 'system', content: 'Tu es un assistant SEO.' },
        { role: 'user', content: 'Propose une idee.' },
        { role: 'assistant', content: 'Premiere proposition.' },
      ],
      temperature: 0.5,
      maxTokens: 250,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        'https://example.test/v1beta/models/gemini-test:generateContent?key=secret',
      ),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'Tu es un assistant SEO.' }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Propose une idee.' }],
            },
            {
              role: 'model',
              parts: [{ text: 'Premiere proposition.' }],
            },
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 250,
          },
        }),
      }),
    );
    expect(response).toEqual({
      provider: 'gemini',
      model: 'gemini-test',
      content: 'Idee SEO generee',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    });
  });
});
