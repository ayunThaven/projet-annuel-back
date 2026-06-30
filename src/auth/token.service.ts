import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuthUser } from './auth.types';

/**
 * Service de token d'acces compatible JWT HS256.
 *
 * Il evite une dependance supplementaire pour le MVP tout en gardant un
 * format utilisable par le front via cookie ou header Authorization.
 */
@Injectable()
export class TokenService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Genere un token signe contenant l'identifiant et l'email utilisateur.
   */
  sign(user: { id: string; email: string }): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresInSeconds = Number(
      this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? 604800,
    );
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

    const expectedSignature = this.signature(`${encodedHeader}.${encodedPayload}`);
    const received = Buffer.from(receivedSignature);
    const expected = Buffer.from(expectedSignature);

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as AuthUser;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Expired token');
    }

    return payload;
  }

  private encode(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private signature(value: string): string {
    return createHmac('sha256', this.secret()).update(value).digest('base64url');
  }

  private secret(): string {
    return (
      this.configService.get<string>('JWT_SECRET') ??
      'change-me-in-production'
    );
  }
}
