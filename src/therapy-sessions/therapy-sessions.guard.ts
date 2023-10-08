import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { includesOther } from 'src/common/utils/includes-other';
import { PsychologistsService } from 'src/psychologists/psychologists.service';
import { PsychologistDocument } from 'src/psychologists/schemas/psychologist.schema';
import { ROLES_KEY } from 'src/roles/decorators/role.docorator';
import { Role } from 'src/roles/enums/roles.enum';
import { UserDocument } from 'src/users/schemas/user.schema';
import { IS_MY_THERAPY_SESSIONS_KEY } from './decorators/is-my-therapy-session.decorator';
import { TherapySessionsService } from './therapy-sessions.service';
import { currentUserAlias } from 'src/common/const/current-user-alias';

@Injectable()
export class TherapySessionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private psychologistsService: PsychologistsService,
    private therapySessionsService: TherapySessionsService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ShouldBeMyTherapySessions =
      this.reflector.getAllAndOverride<boolean>(IS_MY_THERAPY_SESSIONS_KEY, [
        context.getHandler(),
      ]) || false;

    const requiredRoles =
      this.reflector.getAllAndOverride<Array<Role>>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (ShouldBeMyTherapySessions) {
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

        if (params.sessionId) {
          return this.checkIfIsMyTherapySession(psychologist, params.sessionId);
        }

        return true;
      } catch {}

      return false;
    }

    return true;
  }

  async checkIfIsMyTherapySession(
    psychologist: PsychologistDocument,
    sessionId: string | undefined,
  ): Promise<boolean> {
    if (sessionId) {
      const therapySession = await this.therapySessionsService.getById(
        sessionId,
      );

      return (
        therapySession.psychologist._id.toString() ===
        psychologist._id.toString()
      );
    }
    return false;
  }
}
