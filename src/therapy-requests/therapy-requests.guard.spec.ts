import { Reflector } from '@nestjs/core';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { TherapyRequestsGuard } from './therapy-requests.guard';
import { TherapyRequestsService } from './therapy-requests.service';

describe('TherapyRequestsGuard', () => {
  let guard: TherapyRequestsGuard;
  let reflector: jest.Mocked<Reflector>;
  let psychologistsService: jest.Mocked<PsychologistsService>;
  let therapyRequestsService: jest.Mocked<TherapyRequestsService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    psychologistsService = {
      getByUserId: jest.fn(),
    } as any;

    therapyRequestsService = {} as any;

    guard = new TherapyRequestsGuard(
      reflector,
      psychologistsService,
      therapyRequestsService,
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });
});
