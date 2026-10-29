import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const APPLICATION_MESSAGE_MAX_LENGTH = 3500;

export function parseApplicationMessagingEnabled(
  value: string | undefined,
): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(
    'APPLICATION_MESSAGING_ENABLED must be explicitly set to true or false',
  );
}

@Injectable()
export class ApplicationMessagingPolicyService {
  readonly enabled: boolean;

  constructor(configService: ConfigService) {
    this.enabled = parseApplicationMessagingEnabled(
      configService.get<string>('APPLICATION_MESSAGING_ENABLED'),
    );
  }

  canUseAsSoleContact(username?: string): boolean {
    return Boolean(username?.trim()) || this.enabled;
  }
}
