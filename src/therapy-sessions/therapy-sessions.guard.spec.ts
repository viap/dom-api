import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { ROLES_KEY } from '../roles/decorators/role.docorator';
import { Role } from '../roles/enums/roles.enum';
import { IS_MY_THERAPY_SESSIONS_KEY } from './decorators/is-my-therapy-session.decorator';
import { TherapySessionsGuard } from './therapy-sessions.guard';
import { TherapySessionsService } from './therapy-sessions.service';

describe('TherapySessionsGuard', () => {
  let guard: TherapySessionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let psychologistsService: jest.Mocked<PsychologistsService>;
  let therapySessionsService: jest.Mocked<TherapySessionsService>;

  const requiredRoles = [Role.Admin, Role.Editor, Role.Psychologist];

  function run(
    roles: Role[],
    params: Record<string, string>,
    handler: () => void = function someHandler() {},
  ) {
    const request = { userContext: { userId: 'user-id', roles }, params };
    return guard.canActivate({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: jest.fn(),
    } as unknown as ExecutionContext);
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === IS_MY_THERAPY_SESSIONS_KEY
          ? true
          : key === ROLES_KEY
          ? requiredRoles
          : undefined,
      ),
    } as any;

    psychologistsService = {
      getProfileByUserId: jest.fn(),
    } as any;

    therapySessionsService = {
      getById: jest.fn(),
    } as any;

    guard = new TherapySessionsGuard(
      reflector,
      psychologistsService,
      therapySessionsService,
    );
  });

  it('allows admins without a psychologist profile', async () => {
    psychologistsService.getProfileByUserId.mockResolvedValue(null);

    await expect(run([Role.Admin], { sessionId: 's1' })).resolves.toBe(true);
  });

  it('denies a psychologist access to another psychologist session', async () => {
    psychologistsService.getProfileByUserId.mockResolvedValue({
      _id: 'p1',
    } as any);
    therapySessionsService.getById.mockResolvedValue({
      psychologist: { _id: 'p2' },
    } as any);

    await expect(run([Role.Psychologist], { sessionId: 's1' })).resolves.toBe(
      false,
    );
  });

  it('denies a psychologist another psychologist list', async () => {
    psychologistsService.getProfileByUserId.mockResolvedValue({
      _id: 'p1',
    } as any);

    await expect(
      run([Role.Psychologist], { psychologistId: 'p2' }),
    ).resolves.toBe(false);
  });

  describe('as an editor', () => {
    it('is denied another psychologist statistics', async () => {
      psychologistsService.getProfileByUserId.mockResolvedValue({
        _id: 'p1',
      } as any);

      await expect(run([Role.Editor], { psychologistId: 'p2' })).resolves.toBe(
        false,
      );
    });

    it('is denied another psychologist session', async () => {
      psychologistsService.getProfileByUserId.mockResolvedValue({
        _id: 'p1',
      } as any);
      therapySessionsService.getById.mockResolvedValue({
        psychologist: { _id: 'p2' },
      } as any);

      await expect(run([Role.Editor], { sessionId: 's1' })).resolves.toBe(
        false,
      );
    });

    it('is denied without a psychologist profile', async () => {
      psychologistsService.getProfileByUserId.mockResolvedValue(null);

      await expect(run([Role.Editor], { sessionId: 's1' })).resolves.toBe(
        false,
      );
    });
  });

  describe('owner-only routes without an id', () => {
    beforeEach(() => {
      psychologistsService.getProfileByUserId.mockResolvedValue({
        _id: 'p1',
      } as any);
    });

    it('allows the listed POST /me handler', async () => {
      await expect(
        run([Role.Psychologist], {}, function createForMe() {}),
      ).resolves.toBe(true);
    });

    it('denies any other handler without an id', async () => {
      await expect(run([Role.Psychologist], {})).resolves.toBe(false);
    });
  });
});
