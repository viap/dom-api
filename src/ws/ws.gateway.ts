import { OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '@/auth/auth.service';
import extractApiClientFromHeaders from '@/common/utils/extract-api-client-from-headers';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationDocument } from '@/notifications/schemas/notification.schema';

// The gateway serves only dom-bot: notification batches carry applicant
// contacts and receipts act on behalf of users. dom-web has no socket client.
// ponytail: in-memory socket set, correct only with a single pm2 fork.
const botSockets = new Set<string>();
const webSocketPort = process.env.WEBSOCKET_PORT
  ? parseInt(process.env.WEBSOCKET_PORT)
  : 3004;
@WebSocketGateway(webSocketPort, {
  transports: ['websocket'],
  // The bot's get-all-batch payload lists up to 5000 session user ids
  // (~27 bytes each, ~135 KB); see MAX_BOT_CANDIDATES.
  maxHttpBufferSize: 2e5,
  cors: {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST'],
  },
})
export class WsGateway implements OnModuleInit, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private authService: AuthService,
    private notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.server.on('connection', (client: Socket) => {
      const initClient = extractApiClientFromHeaders(client.handshake.headers);

      if (
        initClient &&
        initClient.name === process.env.BOT_CLIENT_NAME &&
        this.authService.isAvailableClient(initClient)
      ) {
        botSockets.add(client.id);
        client.emit('inited', {
          clientId: client.id,
          apiClient: initClient.name,
        });
        return;
      }

      client.emit('unauthorized', { message: 'Unauthorized client' });
      client.disconnect(true);
    });
  }

  handleDisconnect(client: Socket) {
    botSockets.delete(client.id);
  }

  @SubscribeMessage('notifications/get-all-batch')
  async getAllActiveEventsBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { userIds?: Array<string> },
  ): Promise<Array<NotificationDocument | Record<string, unknown>>> {
    if (!botSockets.has(client.id)) {
      return [];
    }

    // The bot sends the user ids it has sessions for and gets back, per
    // notification, which of them are eligible by current roles.
    return this.notificationsService.getAllActiveForBot(data?.userIds);
  }

  @SubscribeMessage('notifications/add-received')
  async addReceived(
    @MessageBody()
    data: { notificationId: string; userId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<boolean> {
    if (!botSockets.has(client.id)) {
      return false;
    }

    const notificationId = data?.notificationId;
    const userId = typeof data?.userId === 'string' ? data.userId : undefined;

    // The audience is rechecked against current data in addReceived.
    return userId
      ? this.notificationsService.addReceived(notificationId, userId)
      : false;
  }
}
