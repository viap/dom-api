import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiClientsService } from '../api-clients/api-clients.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const mockApiClientsService = {
      findOne: jest.fn(),
    };

    const mockJwtService = {
      verifyAsync: jest.fn(),
      decode: jest.fn(),
      signAsync: jest.fn(),
    };

    const mockUsersService = {
      getById: jest.fn(),
      getByTelegramId: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ApiClientsService,
          useValue: mockApiClientsService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
