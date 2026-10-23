import { Test, TestingModule } from '@nestjs/testing';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationDocument } from '../notifications/schemas/notification.schema';
import { WsGateway } from './ws.gateway';

describe('WsGateway', () => {
  let gateway: WsGateway;
  let mockAuthService: {
    verifyToken: jest.Mock;
    isAvailableClient: jest.Mock;
    decode: jest.Mock;
  };
  let mockNotificationsService: {
    getAllActive: jest.Mock;
    getAllByUserId: jest.Mock;
    addReceived: jest.Mock;
  };
  let connectionHandler: (client: unknown) => Promise<void>;

  beforeEach(async () => {
    mockAuthService = {
      verifyToken: jest.fn(),
      isAvailableClient: jest.fn(),
      decode: jest.fn(),
    };

    mockNotificationsService = {
      getAllActive: jest.fn(),
      getAllByUserId: jest.fn(),
      addReceived: jest.fn(),
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
    gateway.server = {
      on: jest.fn((_event, handler) => {
        connectionHandler = handler;
      }),
    } as never;
    gateway.onModuleInit();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('returns active notifications through the ACK batch event for API clients', async () => {
    const notifications = [{ _id: 'notification-1' }];
    const client = createClient(
      'batch-authorized',
      `ApiClient ${JSON.stringify({ name: 'bot', password: 'secret' })}`,
    );

    mockAuthService.isAvailableClient.mockReturnValue(true);
    mockNotificationsService.getAllActive.mockResolvedValue(notifications);

    await connectionHandler(client);

    await expect(
      gateway.getAllActiveEventsBatch(client as never),
    ).resolves.toBe(notifications);
    expect(mockNotificationsService.getAllActive).toHaveBeenCalledTimes(1);
  });

  it('uses the same active notification source for the streamed event', async () => {
    const notifications = [
      { _id: 'notification-1' },
      { _id: 'notification-2' },
    ];
    const client = createClient(
      'stream-authorized',
      `ApiClient ${JSON.stringify({ name: 'bot', password: 'secret' })}`,
    );

    mockAuthService.isAvailableClient.mockReturnValue(true);
    mockNotificationsService.getAllActive.mockResolvedValue(notifications);

    await connectionHandler(client);

    const result = await gateway.getAllActiveEvents(client as never);

    await expect(collectObservable(result)).resolves.toEqual([
      { event: 'notification', data: notifications[0] },
      { event: 'notification', data: notifications[1] },
    ]);
    expect(mockNotificationsService.getAllActive).toHaveBeenCalledTimes(1);
  });

  describe('connection lifecycle', () => {
    it('disconnects sockets without valid credentials', async () => {
      const anonymous = createClient('anonymous-socket');
      const badToken = createClient('bad-token-socket', 'Bearer forged');
      mockAuthService.verifyToken.mockResolvedValue(undefined);

      await connectionHandler(anonymous);
      await connectionHandler(badToken);

      expect(anonymous.disconnect).toHaveBeenCalledWith(true);
      expect(badToken.disconnect).toHaveBeenCalledWith(true);
    });

    it('forgets a user socket after disconnect', async () => {
      const client = createClient('user-socket', 'Bearer valid');
      mockAuthService.verifyToken.mockResolvedValue({ userId: 'user-1' });
      mockNotificationsService.addReceived.mockResolvedValue(true);

      await connectionHandler(client);
      gateway.handleDisconnect(client as never);

      await expect(
        gateway.addReceived({ notificationId: 'n1' }, client as never),
      ).resolves.toBe(false);
      expect(mockNotificationsService.addReceived).not.toHaveBeenCalled();
    });
  });

  describe('notifications/add-received', () => {
    const originalBotClientName = process.env.BOT_CLIENT_NAME;

    beforeEach(() => {
      process.env.BOT_CLIENT_NAME = 'domBot';
      mockAuthService.isAvailableClient.mockReturnValue(true);
      mockAuthService.decode.mockResolvedValue({ userId: 'victim-id' });
      mockNotificationsService.addReceived.mockResolvedValue(true);
    });

    afterEach(() => {
      process.env.BOT_CLIENT_NAME = originalBotClientName;
    });

    it('lets the bot claim a receipt for the user in its session token', async () => {
      const client = createClient(
        'bot-socket',
        `ApiClient ${JSON.stringify({ name: 'domBot', password: 'secret' })}`,
      );
      await connectionHandler(client);

      await expect(
        gateway.addReceived(
          { notificationId: 'n1', token: 'session-token' },
          client as never,
        ),
      ).resolves.toBe(true);
      expect(mockNotificationsService.addReceived).toHaveBeenCalledWith(
        'n1',
        'victim-id',
      );
    });

    it('ignores tokens sent by other API clients', async () => {
      const client = createClient(
        'web-socket',
        `ApiClient ${JSON.stringify({ name: 'domWeb', password: 'secret' })}`,
      );
      await connectionHandler(client);

      await expect(
        gateway.addReceived(
          { notificationId: 'n1', token: 'forged' },
          client as never,
        ),
      ).resolves.toBe(false);
      expect(mockNotificationsService.addReceived).not.toHaveBeenCalled();
    });

    it('uses only the authenticated user of a user socket', async () => {
      const client = createClient('own-user-socket', 'Bearer valid');
      mockAuthService.verifyToken.mockResolvedValue({ userId: 'own-user' });
      await connectionHandler(client);

      await gateway.addReceived(
        { notificationId: 'n1', token: 'someone-else' },
        client as never,
      );

      expect(mockNotificationsService.addReceived).toHaveBeenCalledWith(
        'n1',
        'own-user',
      );
      expect(mockAuthService.decode).not.toHaveBeenCalled();
    });
  });

  it('preserves empty unauthorized behavior for batch and streamed events', async () => {
    const client = createClient('unauthorized');

    await connectionHandler(client);

    await expect(
      gateway.getAllActiveEventsBatch(client as never),
    ).resolves.toEqual([]);

    const result = await gateway.getAllActiveEvents(client as never);
    await expect(collectObservable(result)).resolves.toEqual([]);
    expect(mockNotificationsService.getAllActive).not.toHaveBeenCalled();
  });
});

function createClient(id: string, authorization?: string) {
  return {
    id,
    handshake: {
      headers: authorization ? { authorization } : {},
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

function collectObservable(
  observable: Observable<{
    event: string;
    data: NotificationDocument;
  }>,
): Promise<Array<{ event: string; data: NotificationDocument }>> {
  return new Promise((resolve, reject) => {
    const values: Array<{ event: string; data: NotificationDocument }> = [];
    observable.subscribe({
      next: (value) => values.push(value),
      error: reject,
      complete: () => resolve(values),
    });
  });
}
