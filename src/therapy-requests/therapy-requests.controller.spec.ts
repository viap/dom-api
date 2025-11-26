import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TherapyRequestsController } from './therapy-requests.controller';
import { TherapyRequestsService } from './therapy-requests.service';
import { TherapyRequestsGuard } from './therapy-requests.guard';
import { PsychologistsService } from '../psychologists/psychologists.service';

describe('RequestsController', () => {
  let controller: TherapyRequestsController;

  beforeEach(async () => {
    const mockTherapyRequestsService = {
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
      controllers: [TherapyRequestsController],
      providers: [
        {
          provide: TherapyRequestsService,
          useValue: mockTherapyRequestsService,
        },
        {
          provide: TherapyRequestsGuard,
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
      .overrideGuard(TherapyRequestsGuard)
      .useValue({})
      .compile();

    controller = module.get<TherapyRequestsController>(
      TherapyRequestsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
