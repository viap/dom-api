import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiClientsService } from '../api-clients/api-clients.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AuthFailureReason } from './enums/auth-failure-reason.enum';

describe('AuthService', () => {
  let service: AuthService;
  let mockApiClientsService: any;
  let mockUsersService: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockApiClientsService = {
      findOne: jest.fn(),
    };

    mockJwtService = {
      verifyAsync: jest.fn(),
      decode: jest.fn(),
      signAsync: jest.fn(),
    };

    mockUsersService = {
      getById: jest.fn(),
      getByTelegramId: jest.fn(),
      getByAuthUser: jest.fn(),
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

  it('isAvailableClient returns true only for exact secret match', () => {
    mockApiClientsService.findOne.mockReturnValue({
      name: 'domWeb',
      password: 'expected-password',
    });

    expect(
      service.isAvailableClient({
        name: 'domWeb',
        password: 'expected-password',
      }),
    ).toBe(true);
    expect(
      service.isAvailableClient({
        name: 'domWeb',
        password: 'wrong-password',
      }),
    ).toBe(false);
  });

  it('throws invalid_api_client reason when api client credentials are wrong', async () => {
    mockApiClientsService.findOne.mockReturnValue({
      name: 'domWeb',
      password: 'expected-password',
    });

    await expect(
      service.signInByAuthUser(
        { name: 'domWeb', password: 'wrong-password' },
        { login: 'vbirilov', password: 'pass' },
        {
          requestId: 'req-1',
          sourceIp: '127.0.0.1',
          normalizedLogin: 'vbirilov',
        },
      ),
    ).rejects.toMatchObject({
      reason: AuthFailureReason.InvalidApiClient,
    });
  });

  it('throws invalid_user_credentials reason when user auth fails', async () => {
    mockApiClientsService.findOne.mockReturnValue({
      name: 'domWeb',
      password: 'expected-password',
    });
    mockUsersService.getByAuthUser.mockResolvedValue(null);

    await expect(
      service.signInByAuthUser(
        { name: 'domWeb', password: 'expected-password' },
        { login: 'vbirilov', password: 'pass' },
        {
          requestId: 'req-2',
          sourceIp: '127.0.0.1',
          normalizedLogin: 'vbirilov',
        },
      ),
    ).rejects.toMatchObject({
      reason: AuthFailureReason.InvalidUserCredentials,
    });
  });

  it('returns auth token when credentials are valid', async () => {
    mockApiClientsService.findOne.mockReturnValue({
      name: 'domWeb',
      password: 'expected-password',
    });
    mockUsersService.getByAuthUser.mockResolvedValue({
      _id: { toString: () => 'user-id' },
      roles: ['admin'],
    });
    mockJwtService.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.signInByAuthUser(
        { name: 'domWeb', password: 'expected-password' },
        { login: 'vbirilov', password: 'pass' },
        {
          requestId: 'req-3',
          sourceIp: '127.0.0.1',
          normalizedLogin: 'vbirilov',
        },
      ),
    ).resolves.toEqual({
      auth_token: 'signed-token',
    });
  });
});
