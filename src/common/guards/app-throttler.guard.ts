import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { getClientIp, isTrustedApiClient } from '@/auth/utils/client-ip';
import extractTokenFromHeaders from '@/common/utils/extract-token-from-headers';

// Same key @Throttle() writes for the "default" throttler (THROTTLER_LIMIT).
const DEFAULT_ROUTE_LIMIT_KEY = 'THROTTLER:LIMIT' + 'default';

// Global rate limiting. Requests are counted per verified user, per Telegram
// id for bot logins, otherwise per client IP. Anonymous reads stay limited only
// where a route declares @Throttle, so public pages and SSR are unaffected.
// ponytail: in-memory storage is per process; use a shared store if the API
// ever runs more than one instance.
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    if (!isRead || extractTokenFromHeaders(req.headers)) {
      return false;
    }

    const routeLimit = this.reflector.getAllAndOverride(
      DEFAULT_ROUTE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    return routeLimit === undefined;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const token = extractTokenFromHeaders(req.headers);
    if (token) {
      try {
        const payload = this.jwtService.verify(token);
        if (payload?.userId) {
          return `user:${payload.userId}`;
        }
      } catch {
        // invalid tokens are counted by IP
      }
    }

    const telegramId = req.body?.telegram?.id;
    if (
      typeof telegramId === 'string' &&
      isTrustedApiClient(req.body?.apiClient, 'BOT')
    ) {
      return `telegram:${telegramId}`;
    }

    return `ip:${getClientIp(req)}`;
  }
}
