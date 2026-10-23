import { EnhancedRequest } from '@/common/types/enhanced-request.interface';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { currentUserAlias } from '@/common/const/current-user-alias';
import { PsychologistsService } from '@/psychologists/psychologists.service';
import { PsychologistDocument } from '@/psychologists/schemas/psychologist.schema';
import { Role } from '@/roles/enums/roles.enum';
import { IS_MY_THERAPY_SESSIONS_KEY } from './decorators/is-my-therapy-session.decorator';
import { TherapySessionsService } from './therapy-sessions.service';

@Injectable()
export class TherapySessionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private psychologistsService: PsychologistsService,
    private therapySessionsService: TherapySessionsService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<EnhancedRequest>();
    const ShouldBeMyTherapySessions =
      this.reflector.getAllAndOverride<boolean>(IS_MY_THERAPY_SESSIONS_KEY, [
        context.getHandler(),
      ]) || false;

    if (ShouldBeMyTherapySessions) {
      try {
        if (!request.userContext) {
          return false;
        }

        const psychologist = await this.psychologistsService.getProfileByUserId(
          request.userContext.userId,
        );

        if (psychologist) {
          request.psychologistContext = {
            id: psychologist._id.toString(),
          };
        }

        // NOTICE: only admins see every psychologist's sessions; editors and
        // psychologists see their own (decision D6).
        if (request.userContext.roles?.includes(Role.Admin)) {
          return true;
        }

        if (!psychologist) {
          return false;
        }

        const params = request.params || {};

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
