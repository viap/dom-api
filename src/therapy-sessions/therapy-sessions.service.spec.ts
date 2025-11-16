import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { UsersService } from '../users/users.service';
import { TherapySession } from './schemas/therapy-session.schema';
import { TherapySessionsService } from './therapy-sessions.service';

describe('TherapySessionsService', () => {
  let service: TherapySessionsService;

  beforeEach(async () => {
    const mockTherapySessionModel = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOne: jest.fn(),
      findByIdAndRemove: jest.fn(),
      aggregate: jest.fn(),
    };

    const mockPsychologistsService = {
      getById: jest.fn(),
      getByUserId: jest.fn(),
    };

    const mockUsersService = {
      getById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TherapySessionsService,
        {
          provide: getModelToken(TherapySession.name),
          useValue: mockTherapySessionModel,
        },
        {
          provide: PsychologistsService,
          useValue: mockPsychologistsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<TherapySessionsService>(TherapySessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
