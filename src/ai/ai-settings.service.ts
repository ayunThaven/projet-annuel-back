import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { UpdateAgencyAiSettingsDto } from './dto/update-agency-ai-settings.dto';
import { AgencyAiSettingsEntity } from './entities/agency-ai-settings.entity';

type RuntimeAiSettings = {
  provider: string;
  model?: string;
  geminiApiKey?: string;
};

@Injectable()
export class AiSettingsService {
  constructor(
    @InjectRepository(AgencyAiSettingsEntity)
    private readonly settingsRepository: Repository<AgencyAiSettingsEntity>,
    private readonly configService: ConfigService,
  ) {}

  async getPublicSettings(agencyId: string) {
    const settings = await this.settingsRepository.findOne({
      where: { agency: { id: agencyId } },
      select: {
        id: true,
        provider: true,
        model: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const provider = settings?.provider
      ? this.getAvailableProvider(settings.provider)
      : this.getDefaultProvider();
    const hasAvailableStoredProvider = settings?.provider === provider;

    return {
      provider,
      model:
        hasAvailableStoredProvider && settings?.model
          ? settings.model
          : this.getDefaultModel(provider),
      geminiApiKeyConfigured:
        (Boolean(settings) && (await this.hasStoredGeminiApiKey(agencyId))) ||
        Boolean(this.configService.get<string>('GEMINI_API_KEY')?.trim()),
      updatedAt: settings?.updatedAt ?? null,
    };
  }

  async updateSettings(agencyId: string, input: UpdateAgencyAiSettingsDto) {
    if (input.geminiApiKey && input.clearGeminiApiKey) {
      throw new BadRequestException(
        'geminiApiKey and clearGeminiApiKey cannot be used together',
      );
    }

    if (input.provider === 'demo' && !this.isDemoProviderAvailable()) {
      throw new BadRequestException(
        'The demo AI provider is only available outside production',
      );
    }

    let settings = await this.settingsRepository.findOne({
      where: { agency: { id: agencyId } },
      select: {
        id: true,
        provider: true,
        model: true,
        geminiApiKeyEncrypted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!settings) {
      settings = this.settingsRepository.create({
        agency: { id: agencyId } as AgencyEntity,
        provider: this.getDefaultProvider(),
        model: null,
        geminiApiKeyEncrypted: null,
      });
    }

    if (input.provider !== undefined) settings.provider = input.provider;
    if (input.model !== undefined) settings.model = input.model.trim();
    if (input.clearGeminiApiKey) settings.geminiApiKeyEncrypted = null;
    if (input.geminiApiKey !== undefined) {
      settings.geminiApiKeyEncrypted = this.encrypt(input.geminiApiKey.trim());
    }

    await this.settingsRepository.save(settings);
    return this.getPublicSettings(agencyId);
  }

  async getRuntimeSettings(agencyId: string): Promise<RuntimeAiSettings> {
    const settings = await this.settingsRepository.findOne({
      where: { agency: { id: agencyId } },
      select: {
        id: true,
        provider: true,
        model: true,
        geminiApiKeyEncrypted: true,
      },
    });

    const provider = settings?.provider
      ? this.getAvailableProvider(settings.provider)
      : this.getDefaultProvider();
    const hasAvailableStoredProvider = settings?.provider === provider;

    return {
      provider,
      ...(hasAvailableStoredProvider && settings?.model
        ? { model: settings.model }
        : { model: this.getDefaultModel(provider) }),
      ...(settings?.geminiApiKeyEncrypted
        ? { geminiApiKey: this.decrypt(settings.geminiApiKeyEncrypted) }
        : {}),
    };
  }

  private async hasStoredGeminiApiKey(agencyId: string) {
    const settings = await this.settingsRepository.findOne({
      where: { agency: { id: agencyId } },
      select: { id: true, geminiApiKeyEncrypted: true },
    });

    return Boolean(settings?.geminiApiKeyEncrypted);
  }

  private getDefaultProvider() {
    const provider =
      this.configService.get<string>('AI_PROVIDER')?.trim() || 'gemini';

    return this.getAvailableProvider(provider);
  }

  private getDefaultModel(provider?: string) {
    return provider === 'demo'
      ? this.configService.get<string>('AI_DEMO_MODEL')?.trim() || 'demo-local'
      : this.configService.get<string>('GEMINI_MODEL')?.trim() ||
          'gemini-3.5-flash';
  }

  private getAvailableProvider(provider?: string) {
    const candidate = provider?.trim() || 'gemini';

    return candidate === 'demo' && !this.isDemoProviderAvailable()
      ? 'gemini'
      : candidate;
  }

  private isDemoProviderAvailable() {
    return this.configService.get<string>('NODE_ENV') !== 'production';
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, encrypted]
      .map((part) => part.toString('base64url'))
      .join('.');
  }

  private decrypt(value: string) {
    const [iv, authTag, encrypted] = value
      .split('.')
      .map((part) => Buffer.from(part, 'base64url'));

    if (!iv || !authTag || !encrypted) {
      throw new InternalServerErrorException(
        'Stored AI credentials are invalid',
      );
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.getEncryptionKey(),
        iv,
      );
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Stored AI credentials cannot be decrypted',
      );
    }
  }

  private getEncryptionKey() {
    const configuredSecret =
      this.configService.get<string>('AI_SETTINGS_ENCRYPTION_KEY')?.trim() ||
      this.configService.get<string>('JWT_SECRET')?.trim();

    if (
      !configuredSecret &&
      this.configService.get<string>('NODE_ENV') === 'production'
    ) {
      throw new InternalServerErrorException(
        'AI_SETTINGS_ENCRYPTION_KEY is required in production',
      );
    }

    return createHash('sha256')
      .update(configuredSecret || 'development-only-ai-settings-secret')
      .digest();
  }
}
