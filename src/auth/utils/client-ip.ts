import { isIP } from 'net';
import { isSameSecret } from '@/common/utils/same-secret';

// dom-web proxies logins from its own server, so it forwards the visitor IP in
// this header. The header is trusted only together with valid web client
// credentials in the same request body.
export const CLIENT_IP_HEADER = 'x-dom-client-ip';

type ClientKind = 'BOT' | 'WEB';

type RequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
  body?: { apiClient?: { name?: unknown; password?: unknown } };
};

export function isTrustedApiClient(
  apiClient: { name?: unknown; password?: unknown } | undefined,
  kind: ClientKind,
): boolean {
  const name = process.env[`${kind}_CLIENT_NAME`];
  const password = process.env[`${kind}_CLIENT_PASSWORD`];

  return (
    !!name &&
    !!password &&
    apiClient?.name === name &&
    typeof apiClient.password === 'string' &&
    isSameSecret(password, apiClient.password)
  );
}

export function getClientIp(req: RequestLike): string {
  const forwarded = req.headers?.[CLIENT_IP_HEADER];

  if (
    typeof forwarded === 'string' &&
    isIP(forwarded) &&
    isTrustedApiClient(req.body?.apiClient, 'WEB')
  ) {
    return forwarded;
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}
