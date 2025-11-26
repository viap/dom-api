import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TherapyRequestsService } from './therapy-requests.service';
import { TherapyRequest } from './schemas/therapy-request.schema';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('RequestsService', () => {
  let service: TherapyRequestsService;

  beforeEach(async () => {
    const mockTherapyRequestModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const mockPsychologistsService = {
      getById: jest.fn(),
      getByUserId: jest.fn(),
    };

    const mockUsersService = {
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockNotificationsService = {
      create: jest.fn(),
      getAll: jest.fn(),
      getAllByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TherapyRequestsService,
        {
          provide: getModelToken(TherapyRequest.name),
          useValue: mockTherapyRequestModel,
        },
        {
          provide: PsychologistsService,
          useValue: mockPsychologistsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<TherapyRequestsService>(TherapyRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
