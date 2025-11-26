import { Test, TestingModule } from '@nestjs/testing';
import { EventsGateway } from './events.gateway';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('EventsGateway', () => {
  let gateway: EventsGateway;

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
        EventsGateway,
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

    gateway = module.get<EventsGateway>(EventsGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
