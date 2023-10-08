import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { currentUserAlias } from 'src/common/const/current-user-alias';
import { includesOther } from 'src/common/utils/includes-other';
import { PsychologistsService } from 'src/psychologists/psychologists.service';
import { ROLES_KEY } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/enums/roles.enum';
import { UserDocument } from 'src/users/schemas/user.schema';
import { IS_MY_DATA } from './decorators/is-my-data.decorator';
import { TherapyRequestsService } from './therapy-requests.service';

@Injectable()
export class TherapyRequestsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private psychologistsService: PsychologistsService,
    private therapyRequestsService: TherapyRequestsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
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
        const user = request.user as UserDocument;
        const psychologist = await this.psychologistsService.getByUserId(
          user._id.toString(),
        );

        if (!psychologist) {
          return false;
        }

        const params = request.params || {};
        request['psychologist'] = psychologist;

        // NOTICE: check if user have any required role except psychologist
        if (
          includesOther<Role>(requiredRoles, user.roles, [Role.Psychologist])
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
