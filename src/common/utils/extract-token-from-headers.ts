import { IncomingHttpHeaders } from 'http';

export default function extractTokenFromHeaders(
  headers: IncomingHttpHeaders,
): string | undefined {
  const [type, token] = headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}
