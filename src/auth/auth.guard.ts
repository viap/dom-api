import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import extractTokenFromHeaders from 'src/common/utils/extract-token-from-headers';
import { UsersService } from 'src/users/users.service';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private reflector: Reflector,
    private userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = extractTokenFromHeaders(request.headers);
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.authService.verifyToken(token);
      // NOTICE: We're assigning the payload to the request object here
      // so that we can access it in our route handlers
      const user = payload?.userId
        ? await this.userService.getById(payload.userId)
        : undefined;

      if (!user) {
        throw new Error();
      }

      request['user'] = user;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
