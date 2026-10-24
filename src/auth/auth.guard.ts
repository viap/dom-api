import { EnhancedRequest } from '@/common/types/enhanced-request.interface';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserContext } from '@/common/user-context/user-context.interface';
import extractTokenFromHeaders from '@/common/utils/extract-token-from-headers';
import { UsersService } from '@/users/users.service';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private reflector: Reflector,
    private usersService: UsersService,
  ) {}

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

    let payload: UserContext | undefined;
    try {
      payload = await this.authService.verifyToken(token);
    } catch {
      throw new UnauthorizedException();
    }

    if (!payload?.userId) {
      throw new UnauthorizedException();
    }

    // Roles come from the database, not the token, so role changes and
    // deleted accounts take effect before the token expires.
    const user = await this.usersService.getById(payload.userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;
    request.userContext = {
      userId: payload.userId,
      roles: user.roles,
      clientName: payload.clientName,
    };
    return true;
  }
}
