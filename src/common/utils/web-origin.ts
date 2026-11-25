import { isIP } from 'node:net';

export function parseCorsOrigins(
  value: string | undefined,
  nodeEnv: string | undefined,
): (string | RegExp)[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length) return ['http://localhost:3006'];
  if (nodeEnv !== 'dev') return origins;

  return origins.map((origin) =>
    origin === 'http://localhost:3000-3999'
      ? /^http:\/\/localhost:3[0-9]{3}$/
      : origin,
  );
}

function isTelegramCompatibleHostname(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/gu, '');
  return isIP(normalizedHostname) !== 0 || normalizedHostname.includes('.');
}

export function parsePublicWebUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error('PUBLIC_WEB_URL environment variable is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('PUBLIC_WEB_URL must be a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('PUBLIC_WEB_URL must use HTTP or HTTPS');
  }

  if (!isTelegramCompatibleHostname(parsed.hostname)) {
    throw new Error('PUBLIC_WEB_URL must use a Telegram-compatible host');
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== '' && parsed.pathname !== '/')
  ) {
    throw new Error('PUBLIC_WEB_URL must contain only an origin');
  }

  return parsed.origin;
}
