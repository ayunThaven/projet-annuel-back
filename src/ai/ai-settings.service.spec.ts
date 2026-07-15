import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiSettingsService } from './ai-settings.service';

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('AiSettingsService', () => {
  it('encrypts an agency key without returning it from the public settings', async () => {
    let saved: Record<string, unknown> | null = null;
    const repository = {
      findOne: jest.fn(async () => saved),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        saved = { ...value, updatedAt: new Date() };
        return saved;
      }),
    };
    const service = new AiSettingsService(
      repository as never,
      createConfig({ AI_SETTINGS_ENCRYPTION_KEY: 'test-encryption-secret' }),
    );

    const publicSettings = await service.updateSettings('agency-1', {
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      geminiApiKey: 'gemini-secret-key',
    });
    const runtimeSettings = await service.getRuntimeSettings('agency-1');

    expect(saved?.geminiApiKeyEncrypted).not.toBe('gemini-secret-key');
    expect(publicSettings).toEqual(
      expect.objectContaining({
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        geminiApiKeyConfigured: true,
      }),
    );
    expect(JSON.stringify(publicSettings)).not.toContain('gemini-secret-key');
    expect(runtimeSettings).toEqual({
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      geminiApiKey: 'gemini-secret-key',
    });
  });

  it('rejects the demo provider in production', async () => {
    const repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = new AiSettingsService(
      repository as never,
      createConfig({ NODE_ENV: 'production' }),
    );

    await expect(
      service.updateSettings('agency-1', { provider: 'demo' }),
    ).rejects.toThrow(BadRequestException);
  });
});
