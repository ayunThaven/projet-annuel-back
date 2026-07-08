import { ConfigService } from '@nestjs/config';
import { AuthCookieService } from './auth-cookie.service';
import { TokenService } from './token.service';

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function createService(values: Record<string, string | undefined> = {}) {
  const config = createConfig(values);
  const tokenService = new TokenService(config);

  return new AuthCookieService(config, tokenService);
}

describe('AuthCookieService', () => {
  it('creates an http-only session cookie in development', () => {
    const service = createService({
      JWT_SECRET: 'a-secure-test-secret-with-more-than-32-characters',
      JWT_EXPIRES_IN_SECONDS: '3600',
    });

    expect(service.createSessionCookie('token-value')).toBe(
      'access_token=token-value; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600',
    );
  });

  it('adds Secure to session cookies in production', () => {
    const service = createService({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-secure-test-secret-with-more-than-32-characters',
    });

    expect(service.createSessionCookie('token-value')).toContain('; Secure');
  });

  it('expires the auth cookie with the same security attributes', () => {
    const service = createService({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-secure-test-secret-with-more-than-32-characters',
    });

    expect(service.createExpiredCookie()).toBe(
      'access_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Secure',
    );
  });

  it('rejects invalid SameSite configuration', () => {
    const service = createService({
      AUTH_COOKIE_SAME_SITE: 'maybe',
      JWT_SECRET: 'a-secure-test-secret-with-more-than-32-characters',
    });

    expect(() => service.onModuleInit()).toThrow(
      'AUTH_COOKIE_SAME_SITE must be strict, lax or none',
    );
  });
});
