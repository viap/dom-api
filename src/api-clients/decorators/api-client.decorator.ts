import { SetMetadata } from '@nestjs/common';

export type ApiClientKind = 'BOT' | 'WEB';

export const API_CLIENT_KIND_KEY = 'apiClientKind';
export const ApiClient = (kind: ApiClientKind) =>
  SetMetadata(API_CLIENT_KIND_KEY, kind);
