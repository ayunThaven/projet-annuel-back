import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgencyEntity } from '../agencies/entities/agency.entity';
import { AgencyMembershipEntity } from '../agencies/entities/agency-membership.entity';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { AgencyNotionConnectionEntity } from './entities/agency-notion-connection.entity';

const NOTION_AUTHORIZE_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
/** Duree de validite du `state` OAuth (anti-CSRF), en secondes. */
const STATE_TTL_SECONDS = 600;

type NotionOAuthState = {
  agencyId: string;
  userId: string;
  nonce: string;
  exp: number;
};

type NotionTokenResponse = {
  access_token: string;
  workspace_id?: string;
  workspace_name?: string | null;
  workspace_icon?: string | null;
  bot_id?: string;
};

/**
 * Gere le flux OAuth Notion par agence : construction de l'URL d'autorisation,
 * echange du code contre un token, stockage chiffre, et lecture du token pour
 * la synchronisation. Le token n'est jamais expose au front.
 */
@Injectable()
export class NotionOAuthService {
  private readonly logger = new Logger(NotionOAuthService.name);

  constructor(
    @InjectRepository(AgencyNotionConnectionEntity)
    private readonly connectionRepository: Repository<AgencyNotionConnectionEntity>,
    @InjectRepository(AgencyMembershipEntity)
    private readonly membershipsRepository: Repository<AgencyMembershipEntity>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Construit l'URL d'autorisation Notion avec un `state` signe correlant
   * l'agence et l'utilisateur initiateur.
   */
  buildAuthorizeUrl(agencyId: string, userId: string): string {
    const clientId = this.getRequiredConfig('NOTION_OAUTH_CLIENT_ID');
    const redirectUri = this.getRedirectUri();
    const state = this.signState(agencyId, userId);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      owner: 'user',
      redirect_uri: redirectUri,
      state,
    });

    return `${NOTION_AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Echange le code OAuth contre un token et persiste la connexion de l'agence.
   * Verifie la signature/expiration du `state` et que l'utilisateur est bien
   * OWNER de l'agence ciblee (defense en profondeur).
   */
  async handleCallback(code: string, rawState: string): Promise<void> {
    const state = this.verifyState(rawState);
    await this.assertOwner(state.userId, state.agencyId);

    const token = await this.exchangeCodeForToken(code);
    await this.upsertConnection(state.agencyId, token);
  }

  /**
   * Vue publique de la connexion — jamais le token.
   */
  async getPublicConnection(agencyId: string) {
    const connection = await this.connectionRepository.findOne({
      where: { agency: { id: agencyId } },
    });

    return {
      connected: Boolean(connection),
      workspaceName: connection?.workspaceName ?? null,
      workspaceIcon: connection?.workspaceIcon ?? null,
      connectedAt: connection?.updatedAt ?? null,
    };
  }

  /**
   * Token d'acces dechiffre pour l'usage interne (synchronisation).
   * Retourne `null` si l'agence n'a pas de connexion Notion.
   */
  async getRuntimeToken(agencyId: string): Promise<string | null> {
    const connection = await this.connectionRepository.findOne({
      where: { agency: { id: agencyId } },
      select: { id: true, accessTokenEncrypted: true },
    });

    if (!connection?.accessTokenEncrypted) {
      return null;
    }

    return this.decrypt(connection.accessTokenEncrypted);
  }

  async disconnect(agencyId: string): Promise<{ success: true }> {
    await this.connectionRepository.delete({ agency: { id: agencyId } });
    return { success: true };
  }

  // --- Interne ---

  private async exchangeCodeForToken(
    code: string,
  ): Promise<NotionTokenResponse> {
    const clientId = this.getRequiredConfig('NOTION_OAUTH_CLIENT_ID');
    const clientSecret = this.getRequiredConfig('NOTION_OAUTH_CLIENT_SECRET');
    const redirectUri = this.getRedirectUri();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );

    let response: Response;
    try {
      response = await fetch(NOTION_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });
    } catch (error) {
      this.logger.error(`Notion token exchange failed: ${String(error)}`);
      throw new BadRequestException('Notion token exchange failed');
    }

    if (!response.ok) {
      const details = await response.text();
      this.logger.error(
        `Notion token exchange rejected (${response.status}): ${details}`,
      );
      throw new BadRequestException('Notion rejected the authorization code');
    }

    return (await response.json()) as NotionTokenResponse;
  }

  private async upsertConnection(agencyId: string, token: NotionTokenResponse) {
    const existing = await this.connectionRepository.findOne({
      where: { agency: { id: agencyId } },
      select: { id: true },
    });

    const connection =
      existing ??
      this.connectionRepository.create({
        agency: { id: agencyId } as AgencyEntity,
      });

    connection.accessTokenEncrypted = this.encrypt(token.access_token);
    connection.workspaceId = token.workspace_id ?? null;
    connection.workspaceName = token.workspace_name ?? null;
    connection.workspaceIcon = token.workspace_icon ?? null;
    connection.botId = token.bot_id ?? null;

    await this.connectionRepository.save(connection);
  }

  private async assertOwner(userId: string, agencyId: string) {
    const membership = await this.membershipsRepository.findOne({
      where: {
        user: { id: userId },
        agency: { id: agencyId },
        role: AgencyRole.OWNER,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Only an agency owner can connect Notion');
    }
  }

  // --- Signature du `state` (HMAC HS256, sans table dediee) ---

  private signState(agencyId: string, userId: string): string {
    const payload: NotionOAuthState = {
      agencyId,
      userId,
      nonce: randomBytes(12).toString('base64url'),
      exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.stateSignature(encoded);

    return `${encoded}.${signature}`;
  }

  private verifyState(rawState: string): NotionOAuthState {
    const [encoded, receivedSignature] = (rawState ?? '').split('.');

    if (!encoded || !receivedSignature) {
      throw new BadRequestException('Invalid OAuth state');
    }

    const expectedSignature = this.stateSignature(encoded);
    const received = Buffer.from(receivedSignature);
    const expected = Buffer.from(expectedSignature);

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new BadRequestException('Invalid OAuth state');
    }

    let payload: NotionOAuthState;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as NotionOAuthState;
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }

    if (
      typeof payload.agencyId !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      throw new BadRequestException('Expired or malformed OAuth state');
    }

    return payload;
  }

  private stateSignature(value: string): string {
    return createHmac('sha256', this.getStateSecret())
      .update(value)
      .digest('base64url');
  }

  private getStateSecret(): string {
    return (
      this.configService.get<string>('JWT_SECRET')?.trim() ||
      'development-only-notion-state-secret'
    );
  }

  // --- Chiffrement du token (AES-256-GCM), meme schema que AiSettingsService ---

  private encrypt(value: string): string {
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

  private decrypt(value: string): string {
    const [iv, authTag, encrypted] = value
      .split('.')
      .map((part) => Buffer.from(part, 'base64url'));

    if (!iv || !authTag || !encrypted) {
      throw new InternalServerErrorException(
        'Stored Notion credentials are invalid',
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
        'Stored Notion credentials cannot be decrypted',
      );
    }
  }

  private getEncryptionKey(): Buffer {
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

  // --- Config ---

  private getRedirectUri(): string {
    return this.getRequiredConfig('NOTION_OAUTH_REDIRECT_URI');
  }

  getFrontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL')?.trim() ||
      'http://localhost:3000'
    );
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured`);
    }

    return value;
  }
}
