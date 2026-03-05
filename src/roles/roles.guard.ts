import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnhancedRequest } from '../common/user-context/user-context.interface';
import { ROLES_KEY } from './decorators/role.docorator';
import { Role } from './enums/roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Array<Role>>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user, userContext } = context
      .switchToHttp()
      .getRequest<EnhancedRequest>();

    const contextRoles = userContext ? userContext.roles : [];
    const availableRoles = user ? user.roles : contextRoles;

    return requiredRoles.some((role) => availableRoles.includes(role));
  }
}
