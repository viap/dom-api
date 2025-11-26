import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PsychologistsService } from './psychologists.service';
import { Psychologist } from './schemas/psychologist.schema';
import { UsersService } from '../users/users.service';

describe('PsychologistService', () => {
  let service: PsychologistsService;

  beforeEach(async () => {
    const mockPsychologistModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const mockUsersService = {
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PsychologistsService,
        {
          provide: getModelToken(Psychologist.name),
          useValue: mockPsychologistModel,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<PsychologistsService>(PsychologistsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
