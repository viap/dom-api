import { Reflector } from '@nestjs/core';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { TherapySessionsGuard } from './therapy-sessions.guard';
import { TherapySessionsService } from './therapy-sessions.service';

describe('TherapySessionsGuard', () => {
  let guard: TherapySessionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let psychologistsService: jest.Mocked<PsychologistsService>;
  let therapySessionsService: jest.Mocked<TherapySessionsService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    psychologistsService = {
      getByUserId: jest.fn(),
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

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });
});
