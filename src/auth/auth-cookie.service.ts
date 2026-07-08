import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

const authCookieName = 'access_token';

type SameSiteValue = 'Strict' | 'Lax' | 'None';

@Injectable()
export class AuthCookieService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  onModuleInit() {
    this.getSameSite();
  }

  createSessionCookie(token: string) {
    return this.serializeCookie(token, this.tokenService.getExpiresInSeconds());
  }

  createExpiredCookie() {
    return this.serializeCookie('', 0);
  }

  private serializeCookie(value: string, maxAge: number) {
    const sameSite = this.getSameSite();
    const parts = [
      `${authCookieName}=${encodeURIComponent(value)}`,
      'HttpOnly',
      'Path=/',
      `SameSite=${sameSite}`,
      `Max-Age=${maxAge}`,
    ];

    if (this.shouldUseSecureCookie(sameSite)) {
      parts.push('Secure');
    }

    return parts.join('; ');
  }

  private getSameSite(): SameSiteValue {
    const value = (
      this.configService.get<string>('AUTH_COOKIE_SAME_SITE') ?? 'lax'
    )
      .trim()
      .toLowerCase();

    if (value === 'strict') {
      return 'Strict';
    }

    if (value === 'lax') {
      return 'Lax';
    }

    if (value === 'none') {
      return 'None';
    }

    throw new Error('AUTH_COOKIE_SAME_SITE must be strict, lax or none');
  }

  private shouldUseSecureCookie(sameSite: SameSiteValue) {
    return (
      this.configService.get<string>('NODE_ENV') === 'production' ||
      this.configService.get<string>('AUTH_COOKIE_SECURE') === 'true' ||
      sameSite === 'None'
    );
  }
}
