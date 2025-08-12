import { IncomingHttpHeaders } from 'http';
import { ApiClientDto } from 'src/api-clients/dto/api-client.dto';

export default function extractApiClientFromHeaders(
  headers: IncomingHttpHeaders,
): ApiClientDto | undefined {
  const [type, token] = headers.authorization?.split(' ') ?? [];

  if (type === 'ApiClient') {
    try {
      const data = JSON.parse(token);

      if (data.name && data.password) {
        return data as ApiClientDto;
      }
    } catch (e) {}
  }

  return undefined;
}
