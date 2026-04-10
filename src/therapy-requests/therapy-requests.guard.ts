import { EnhancedRequest } from '@/common/types/enhanced-request.interface';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { currentUserAlias } from '@/common/const/current-user-alias';
import { includesOther } from '@/common/utils/includes-other';
import { PsychologistsService } from '@/psychologists/psychologists.service';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { IS_MY_DATA } from './decorators/is-my-data.decorator';

@Injectable()
export class TherapyRequestsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private psychologistsService: PsychologistsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<EnhancedRequest>();
    const ShouldBeAvailableIfMyData =
      this.reflector.getAllAndOverride<boolean>(IS_MY_DATA, [
        context.getHandler(),
      ]) || false;

    const requiredRoles =
      this.reflector.getAllAndOverride<Array<Role>>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    try {
      if (!request.userContext) {
        return false;
      }

      const psychologist = await this.psychologistsService.getByUserId(
        request.userContext.userId,
      );

      if (!psychologist) {
        return false;
      }

      const params = request.params || {};
      request.psychologistContext = {
        id: psychologist._id.toString(),
      };

      //NOTICE: user's own data is available even if there is no suitable role
      if (params.psychologistId && ShouldBeAvailableIfMyData) {
        return (
          request.psychologistContext.id === params.psychologistId ||
          params.psychologistId === currentUserAlias
        );
      }

      // NOTICE: check if user have any required role except psychologist role
      if (
        includesOther<Role>(requiredRoles, request.userContext.roles, [
          Role.Psychologist,
        ])
      ) {
        return true;
      }

      return true;
    } catch {}

    return false;
  }
}
