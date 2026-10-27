import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications/notifications.service';
import { WsGateway } from './ws.gateway';

describe('WsGateway', () => {
  let gateway: WsGateway;
  let mockNotificationsService: {
    getAllActiveForBot: jest.Mock;
    addReceived: jest.Mock;
  };
  let connectionHandler: (client: unknown) => void;
  const originalBotClientName = process.env.BOT_CLIENT_NAME;
  const originalBotClientPassword = process.env.BOT_CLIENT_PASSWORD;

  const botHeader = `ApiClient ${JSON.stringify({
    name: 'domBot',
    password: 'secret',
  })}`;

  beforeEach(async () => {
    process.env.BOT_CLIENT_NAME = 'domBot';
    process.env.BOT_CLIENT_PASSWORD = 'secret';
    mockNotificationsService = {
      getAllActiveForBot: jest.fn(),
      addReceived: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsGateway,
        { provide: NotificationsService, useValue: mockNotificationsService },
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

  afterEach(() => {
    process.env.BOT_CLIENT_NAME = originalBotClientName;
    process.env.BOT_CLIENT_PASSWORD = originalBotClientPassword;
  });

  it('serves notification batches to the bot', async () => {
    const notifications = [{ _id: 'notification-1' }];
    const client = createClient('bot-batch', botHeader);
    mockNotificationsService.getAllActiveForBot.mockResolvedValue(
      notifications,
    );

    connectionHandler(client);

    await expect(
      gateway.getAllActiveEventsBatch(client as never, { userIds: ['u1'] }),
    ).resolves.toBe(notifications);
    expect(mockNotificationsService.getAllActiveForBot).toHaveBeenCalledWith([
      'u1',
    ]);
  });

  it.each([
    ['anonymous', undefined],
    ['user token', 'Bearer some-jwt'],
    [
      'other API client',
      `ApiClient ${JSON.stringify({ name: 'domWeb', password: 'secret' })}`,
    ],
  ])('disconnects a %s socket and serves it nothing', async (_, header) => {
    const client = createClient(`socket-${_}`, header);

    connectionHandler(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    await expect(
      gateway.getAllActiveEventsBatch(client as never, { userIds: [] }),
    ).resolves.toEqual([]);
    await expect(
      gateway.addReceived(
        { notificationId: 'n1', userId: 'u1' },
        client as never,
      ),
    ).resolves.toBe(false);
    expect(mockNotificationsService.addReceived).not.toHaveBeenCalled();
  });

  it('forgets the bot socket after disconnect', async () => {
    const client = createClient('bot-gone', botHeader);
    connectionHandler(client);
    gateway.handleDisconnect(client as never);

    await expect(
      gateway.addReceived(
        { notificationId: 'n1', userId: 'u1' },
        client as never,
      ),
    ).resolves.toBe(false);
  });

  it('takes the recipient userId from the bot', async () => {
    const client = createClient('bot-receipt', botHeader);
    connectionHandler(client);

    await expect(
      gateway.addReceived(
        { notificationId: 'n1', userId: 'u1' },
        client as never,
      ),
    ).resolves.toBe(true);
    expect(mockNotificationsService.addReceived).toHaveBeenCalledWith(
      'n1',
      'u1',
    );
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
