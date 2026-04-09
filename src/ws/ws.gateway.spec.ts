import { Test, TestingModule } from '@nestjs/testing';
import { WsGateway } from './ws.gateway';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('WsGateway', () => {
  let gateway: WsGateway;

  beforeEach(async () => {
    const mockAuthService = {
      validateApiClient: jest.fn(),
      validateTokenAndGetUser: jest.fn(),
    };

    const mockNotificationsService = {
      getAll: jest.fn(),
      getAllByUserId: jest.fn(),
      create: jest.fn(),
      markAsReceived: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsGateway,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    gateway = module.get<WsGateway>(WsGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
