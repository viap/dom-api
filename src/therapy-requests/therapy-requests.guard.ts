import { EnhancedRequest } from '@/common/types/enhanced-request.interface';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { currentUserAlias } from 'src/common/const/current-user-alias';
import { includesOther } from 'src/common/utils/includes-other';
import { PsychologistsService } from 'src/psychologists/psychologists.service';
import { ROLES_KEY } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/enums/roles.enum';
import { IS_MY_DATA } from './decorators/is-my-data.decorator';

@Injectable()
export class TherapyRequestsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private psychologistsService: PsychologistsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<EnhancedRequest>();
    const ShouldBeMyData =
      this.reflector.getAllAndOverride<boolean>(IS_MY_DATA, [
        context.getHandler(),
      ]) || false;

    const requiredRoles =
      this.reflector.getAllAndOverride<Array<Role>>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (ShouldBeMyData) {
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
          id: psychologist._id,
        };

        // NOTICE: check if user have any required role except psychologist
        if (
          includesOther<Role>(requiredRoles, request.userContext.roles, [
            Role.Psychologist,
          ])
        ) {
          return true;
        }

        if (params.psychologistId) {
          return (
            psychologist._id.toString() === params.psychologistId ||
            params.psychologistId === currentUserAlias
          );
        }

        return true;
      } catch {}

      return false;
    }

    return true;
  }
}
