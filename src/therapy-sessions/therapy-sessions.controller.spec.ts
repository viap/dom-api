import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { TherapySessionsController } from './therapy-sessions.controller';
import { TherapySessionsGuard } from './therapy-sessions.guard';
import { TherapySessionsService } from './therapy-sessions.service';
import { EnhancedRequest } from '../common/types/enhanced-request.interface';
import { ROLES_KEY } from '../roles/decorators/role.docorator';
import { Role } from '../roles/enums/roles.enum';

describe('TherapySessionsController', () => {
  let controller: TherapySessionsController;

  beforeEach(async () => {
    const mockTherapySessionsService = {
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockPsychologistsService = {
      getByUserId: jest.fn(),
    };

    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TherapySessionsController],
      providers: [
        {
          provide: TherapySessionsService,
          useValue: mockTherapySessionsService,
        },
        {
          provide: TherapySessionsGuard,
          useValue: {},
        },
        {
          provide: PsychologistsService,
          useValue: mockPsychologistsService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    })
      .overrideGuard(TherapySessionsGuard)
      .useValue({})
      .compile();

    controller = module.get<TherapySessionsController>(
      TherapySessionsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it.each([
    ['getAllForPeriod', [Role.Admin]],
    ['getStatisticForPeriod', [Role.Admin, Role.Accountant]],
    ['create', [Role.Admin]],
  ] as const)('%s is limited to %p', (method, roles) => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapySessionsController.prototype[method],
      ),
    ).toEqual(roles);
  });

  it('personal statistic for "me" never falls back to everyone', async () => {
    await expect(
      controller.getStatisticForPsychologistForPeriod(
        {} as EnhancedRequest,
        'me',
        0,
        1,
      ),
    ).resolves.toEqual([]);
  });
});
