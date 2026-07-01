const localDevelopmentOriginPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

export function parseCorsOrigins(rawOrigins?: string) {
  return (rawOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function getConfiguredCorsOrigins() {
  return parseCorsOrigins(process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL);
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  allowLocalDevelopmentOrigins: boolean,
) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = origin.replace(/\/$/, '');

  return (
    allowedOrigins.includes(normalizedOrigin) ||
    (allowLocalDevelopmentOrigins &&
      localDevelopmentOriginPattern.test(normalizedOrigin))
  );
}

export function createCorsOriginResolver() {
  const allowedOrigins = getConfiguredCorsOrigins();
  const allowLocalDevelopmentOrigins = process.env.NODE_ENV !== 'production';

  return async (origin: string | undefined) =>
    isCorsOriginAllowed(origin, allowedOrigins, allowLocalDevelopmentOrigins);
}

export const corsMethods = [
  'GET',
  'HEAD',
  'POST',
  'PATCH',
  'PUT',
  'DELETE',
  'OPTIONS',
];
