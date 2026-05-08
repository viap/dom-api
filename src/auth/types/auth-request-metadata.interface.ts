import { AuthFailureReason } from '../enums/auth-failure-reason.enum';

export interface AuthRequestMetadata {
  requestId: string;
  sourceIp: string;
  userAgent?: string;
  normalizedLogin?: string;
  clientName?: string;
}

export interface AuthFailureLogContext {
  reason: AuthFailureReason;
  metadata: AuthRequestMetadata;
  locked?: boolean;
}
