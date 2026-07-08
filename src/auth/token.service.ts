import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { AuthUser } from './auth.types';

/**
 * Service de token d'acces compatible JWT HS256.
 *
 * Il evite une dependance supplementaire pour le MVP tout en gardant un
 * format utilisable par le front via cookie ou header Authorization.
 */
@Injectable()
export class TokenService implements OnModuleInit {
  private readonly developmentSecret = randomBytes(32).toString('hex');

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.secret();
    this.getExpiresInSeconds();
  }

  /**
   * Genere un token signe contenant l'identifiant et l'email utilisateur.
   */
  sign(user: { id: string; email: string }): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = this.getExpiresInSeconds();
    const payload: AuthUser = {
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + expiresInSeconds,
    };
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.encode(header);
    const encodedPayload = this.encode(payload);
    const signature = this.signature(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verifie la signature et l'expiration du token avant de retourner le payload.
   */
  verify(token: string): AuthUser {
    const [encodedHeader, encodedPayload, receivedSignature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !receivedSignature) {
      throw new UnauthorizedException('Invalid token');
    }

    const expectedSignature = this.signature(
      `${encodedHeader}.${encodedPayload}`,
    );
    const received = Buffer.from(receivedSignature);
    const expected = Buffer.from(expectedSignature);

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    const header = this.decodePart<{ alg?: string; typ?: string }>(
      encodedHeader,
    );

    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new UnauthorizedException('Invalid token');
    }

    const payload = this.decodePart<unknown>(encodedPayload);

    if (!this.isAuthUser(payload)) {
      throw new UnauthorizedException('Invalid token');
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Expired token');
    }

    return payload;
  }

  private encode(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private decodePart<T>(value: string): T {
    try {
      return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private signature(value: string): string {
    return createHmac('sha256', this.secret())
      .update(value)
      .digest('base64url');
  }

  getExpiresInSeconds(): number {
    const rawValue =
      this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? '604800';
    const expiresInSeconds = Number(rawValue);

    if (
      !Number.isInteger(expiresInSeconds) ||
      !Number.isFinite(expiresInSeconds) ||
      expiresInSeconds <= 0
    ) {
      throw new Error('JWT_EXPIRES_IN_SECONDS must be a positive integer');
    }

    return expiresInSeconds;
  }

  private secret(): string {
    const configuredSecret = this.configService
      .get<string>('JWT_SECRET')
      ?.trim();
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (!configuredSecret) {
      if (isProduction) {
        throw new Error('JWT_SECRET is required in production');
      }

      return this.developmentSecret;
    }

    if (isProduction && this.isWeakProductionSecret(configuredSecret)) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters and not use a default value',
      );
    }

    return configuredSecret;
  }

  private isWeakProductionSecret(secret: string) {
    return (
      secret.length < 32 ||
      [
        'change-me',
        'change-me-in-production',
        'dev-only-change-me-at-least-32-characters',
      ].includes(secret)
    );
  }

  private isAuthUser(value: unknown): value is AuthUser {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const payload = value as Record<string, unknown>;

    return (
      typeof payload.sub === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.iat === 'number' &&
      typeof payload.exp === 'number'
    );
  }
}
