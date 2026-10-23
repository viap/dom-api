import { Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@/auth/auth.guard';
import { RolesGuard } from '@/roles/roles.guard';
import { AppThrottlerGuard } from './app-throttler.guard';

// Global guards in execution order: rate limit first, then authentication,
// then roles. Shared with the e2e test module so tests cannot drift from
// production.
export const APP_GUARD_PROVIDERS: Provider[] = [
  { provide: APP_GUARD, useClass: AppThrottlerGuard },
  { provide: APP_GUARD, useClass: AuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
];
