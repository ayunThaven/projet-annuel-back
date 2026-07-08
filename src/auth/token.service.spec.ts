import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

function createConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('TokenService', () => {
  it('signs and verifies an access token with a configured secret', () => {
    const service = new TokenService(
      createConfig({
        JWT_SECRET: 'a-secure-test-secret-with-more-than-32-characters',
      }),
    );

    const token = service.sign({
      id: 'user-id',
      email: 'owner@example.com',
    });

    expect(service.verify(token)).toMatchObject({
      sub: 'user-id',
      email: 'owner@example.com',
    });
  });

  it('rejects tampered tokens', () => {
    const service = new TokenService(
      createConfig({
        JWT_SECRET: 'a-secure-test-secret-with-more-than-32-characters',
      }),
    );
    const token = service.sign({
      id: 'user-id',
      email: 'owner@example.com',
    });
    const [header, payload] = token.split('.');

    expect(() => service.verify(`${header}.${payload}.bad-signature`)).toThrow(
      UnauthorizedException,
    );
  });

  it('requires an explicit JWT secret in production', () => {
    const service = new TokenService(
      createConfig({
        NODE_ENV: 'production',
      }),
    );

    expect(() => service.onModuleInit()).toThrow(
      'JWT_SECRET is required in production',
    );
  });

  it('rejects weak default secrets in production', () => {
    const service = new TokenService(
      createConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-in-production',
      }),
    );

    expect(() => service.onModuleInit()).toThrow(
      'JWT_SECRET must be at least 32 characters and not use a default value',
    );
  });
});
