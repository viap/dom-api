import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isTrustedApiClient } from '@/auth/utils/client-ip';
import {
  API_CLIENT_KIND_KEY,
  ApiClientKind,
} from './decorators/api-client.decorator';

@Injectable()
export class ApiClientGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const kind = this.reflector.getAllAndOverride<ApiClientKind>(
      API_CLIENT_KIND_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!kind) return true;

    const request = context.switchToHttp().getRequest<{
      body?: { apiClient?: { name?: unknown; password?: unknown } };
    }>();
    if (!isTrustedApiClient(request.body?.apiClient, kind)) {
      throw new UnauthorizedException('Invalid API client');
    }
    return true;
  }
}
