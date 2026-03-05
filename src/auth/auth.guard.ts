import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  EnhancedRequest,
  UserContext,
} from 'src/common/user-context/user-context.interface';
import extractTokenFromHeaders from 'src/common/utils/extract-token-from-headers';
import { Role } from 'src/roles/enums/roles.enum';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<EnhancedRequest>();
    const token = extractTokenFromHeaders(request.headers);
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.authService.verifyToken(token);

      if (!payload?.userId) {
        throw new Error('Invalid token payload');
      }

      // User context from JWT payload
      request.userContext = {
        userId: payload.userId,
        roles: payload.roles as Role[],
        clientName: payload.clientName,
      } as UserContext;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
