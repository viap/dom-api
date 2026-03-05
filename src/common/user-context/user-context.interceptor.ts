import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { UsersService } from 'src/users/users.service';
import { EnhancedRequest } from './user-context.interface';

@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  constructor(private readonly usersService: UsersService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<EnhancedRequest>> {
    const request = context.switchToHttp().getRequest<EnhancedRequest>();

    if (request.userContext && !request.user) {
      try {
        const user = await this.usersService.getById(
          request.userContext.userId,
        );

        if (user) {
          request.user = user;
          request.userContext = {
            ...request.userContext,
            roles: user.roles,
          };
        }
      } catch (error) {
        // Silently fail - user context is available as fallback
      }
    }

    return next.handle();
  }
}
