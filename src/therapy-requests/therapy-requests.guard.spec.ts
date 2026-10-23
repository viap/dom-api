import { ExecutionContext } from '@nestjs/common';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { Role } from '../roles/enums/roles.enum';
import { TherapyRequestsGuard } from './therapy-requests.guard';
import { TherapyRequestsService } from './therapy-requests.service';

describe('TherapyRequestsGuard', () => {
  let guard: TherapyRequestsGuard;
  let psychologistsService: jest.Mocked<PsychologistsService>;
  let therapyRequestsService: jest.Mocked<TherapyRequestsService>;

  const P1 = 'psychologist-1';
  const P2 = 'psychologist-2';

  function run(roles: Role[], params: Record<string, string>) {
    const request = { userContext: { userId: 'user-id', roles }, params };
    return guard.canActivate({
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext);
  }

  beforeEach(() => {
    psychologistsService = {
      getProfileByUserId: jest.fn(),
    } as any;
    therapyRequestsService = {
      getAssignedPsychologistId: jest.fn(),
    } as any;

    guard = new TherapyRequestsGuard(
      psychologistsService,
      therapyRequestsService,
    );
  });

  describe('as psychologist P1', () => {
    beforeEach(() => {
      psychologistsService.getProfileByUserId.mockResolvedValue({
        _id: P1,
      } as any);
    });

    it('allows own assigned request', async () => {
      therapyRequestsService.getAssignedPsychologistId.mockResolvedValue(P1);
      await expect(
        run([Role.Psychologist], { therapyRequestId: 'r1' }),
      ).resolves.toBe(true);
    });

    it.each([P2, null])('denies request assigned to %s', async (owner) => {
      therapyRequestsService.getAssignedPsychologistId.mockResolvedValue(owner);
      await expect(
        run([Role.Psychologist], { therapyRequestId: 'r1' }),
      ).resolves.toBe(false);
    });

    it.each(['me', P1])('allows own list via %s', async (psychologistId) => {
      await expect(run([Role.Psychologist], { psychologistId })).resolves.toBe(
        true,
      );
    });

    it('denies another psychologist list', async () => {
      await expect(
        run([Role.Psychologist], { psychologistId: P2 }),
      ).resolves.toBe(false);
    });

    it('denies routes without an owned resource', async () => {
      await expect(run([Role.Psychologist], {})).resolves.toBe(false);
    });
  });

  it.each([Role.Admin, Role.Editor])(
    'allows %s without a psychologist profile',
    async (role) => {
      psychologistsService.getProfileByUserId.mockResolvedValue(null);
      await expect(run([role], { therapyRequestId: 'r1' })).resolves.toBe(true);
      expect(
        therapyRequestsService.getAssignedPsychologistId,
      ).not.toHaveBeenCalled();
    },
  );

  it('denies users without a psychologist profile', async () => {
    psychologistsService.getProfileByUserId.mockResolvedValue(null);
    await expect(run([Role.User], {})).resolves.toBe(false);
  });
});
