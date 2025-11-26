import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { TherapySessionsController } from './therapy-sessions.controller';
import { TherapySessionsGuard } from './therapy-sessions.guard';
import { TherapySessionsService } from './therapy-sessions.service';

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
});
