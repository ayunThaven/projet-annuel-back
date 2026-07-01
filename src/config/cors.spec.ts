import { isCorsOriginAllowed, parseCorsOrigins } from './cors';

describe('cors configuration', () => {
  it('parses comma-separated origins and normalizes trailing slashes', () => {
    expect(
      parseCorsOrigins(' http://localhost:3000/,https://app.example.com '),
    ).toEqual(['http://localhost:3000', 'https://app.example.com']);
  });

  it('allows explicitly configured origins', () => {
    expect(
      isCorsOriginAllowed(
        'https://app.example.com',
        ['https://app.example.com'],
        false,
      ),
    ).toBe(true);
  });

  it('allows localhost on any port in development mode', () => {
    expect(isCorsOriginAllowed('http://localhost:5173', [], true)).toBe(true);
    expect(isCorsOriginAllowed('http://127.0.0.1:4200', [], true)).toBe(true);
  });

  it('does not allow arbitrary origins in production mode', () => {
    expect(isCorsOriginAllowed('http://localhost:5173', [], false)).toBe(false);
    expect(isCorsOriginAllowed('https://evil.example.com', [], false)).toBe(
      false,
    );
  });
});
