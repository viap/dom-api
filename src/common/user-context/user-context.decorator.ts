import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { EnhancedRequest, UserContext } from './user-context.interface';

export const GetUserContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserContext | null => {
    const request = ctx.switchToHttp().getRequest<EnhancedRequest>();
    return request.userContext || null;
  },
);

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<EnhancedRequest>();
    return request.user || null;
  },
);
