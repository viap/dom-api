import { EnhancedRequest } from '@/common/types/enhanced-request.interface';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { currentUserAlias } from '@/common/const/current-user-alias';
import { PsychologistsService } from '@/psychologists/psychologists.service';
import { Role } from '@/roles/enums/roles.enum';
import { TherapyRequestsService } from './therapy-requests.service';

// Admins and editors manage all requests; a psychologist reaches only the
// requests currently assigned to them.
@Injectable()
export class TherapyRequestsGuard implements CanActivate {
  constructor(
    private psychologistsService: PsychologistsService,
    private therapyRequestsService: TherapyRequestsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<EnhancedRequest>();

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

      const roles = request.userContext.roles || [];
      if (roles.includes(Role.Admin) || roles.includes(Role.Editor)) {
        return true;
      }

      if (!request.psychologistContext) {
        return false;
      }

      const ownId = request.psychologistContext.id;
      const params = request.params || {};

      if (params.psychologistId) {
        return (
          params.psychologistId === ownId ||
          params.psychologistId === currentUserAlias
        );
      }

      if (params.therapyRequestId) {
        const assignedPsychologistId =
          await this.therapyRequestsService.getAssignedPsychologistId(
            params.therapyRequestId,
          );
        return assignedPsychologistId === ownId;
      }
    } catch {}

    return false;
  }
}
