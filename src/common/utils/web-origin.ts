import { isIP } from 'node:net';

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
