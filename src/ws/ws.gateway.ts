import { OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Server, Socket } from 'socket.io';
import { ApiClientDto } from '@/api-clients/dto/api-client.dto';
import { AuthService } from '@/auth/auth.service';
import extractApiClientFromHeaders from '@/common/utils/extract-api-client-from-headers';
import extractTokenFromHeaders from '@/common/utils/extract-token-from-headers';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationDocument } from '@/notifications/schemas/notification.schema';

const socketToUser: { [key: string]: string } = {};
const socketToApiClient: { [key: string]: ApiClientDto } = {};
const webSocketPort = process.env.WEBSOCKET_PORT
  ? parseInt(process.env.WEBSOCKET_PORT)
  : 3004;
@WebSocketGateway(webSocketPort, {
  transports: ['websocket'],
  maxHttpBufferSize: 1e5,
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
    this.server.on('connection', async (client: Socket) => {
      // NOTICE: authorization by token
      const token = extractTokenFromHeaders(client.handshake.headers);
      // NOTICE: authorization by ApiClient
      const initClient = extractApiClientFromHeaders(client.handshake.headers);

      if (token) {
        const payload = await this.authService.verifyToken(token);

        if (payload?.userId) {
          socketToUser[client.id] = payload.userId;
          client.emit('inited', {
            clientId: client.id,
            userId: payload.userId,
          });
          return;
        }
      } else if (initClient) {
        if (this.authService.isAvailableClient(initClient)) {
          socketToApiClient[client.id] = initClient;
          client.emit('inited', {
            clientId: client.id,
            apiClient: initClient.name,
          });
          return;
        }

        client.emit('unauthorized', {
          message: 'Unauthorized API client',
        });
      }

      // Unauthenticated sockets are not kept open.
      client.disconnect(true);
    });
  }

  handleDisconnect(client: Socket) {
    delete socketToUser[client.id];
    delete socketToApiClient[client.id];
  }

  @SubscribeMessage('auth-by-token')
  async authUser(
    @MessageBody('token') token: string,
    @ConnectedSocket() client: Socket,
  ) {
    const payload = await this.authService.verifyToken(token);
    if (payload?.userId) {
      socketToUser[client.id] = payload.userId;
    }
  }

  @SubscribeMessage('notifications/get-my')
  async getEventsForMe(
    @ConnectedSocket() client: Socket,
  ): Promise<Observable<WsResponse<NotificationDocument>> | never> {
    const userId = socketToUser[client.id];

    let notifications: Array<NotificationDocument> = [];

    if (userId) {
      notifications = await this.notificationsService.getAllByUserId(userId);
    }

    return from(notifications).pipe(
      map((event) => ({ event: 'notification', data: event })),
    );
  }

  @SubscribeMessage('notifications/get-all')
  async getAllActiveEvents(
    @ConnectedSocket() client: Socket,
  ): Promise<Observable<WsResponse<NotificationDocument>> | never> {
    const notifications = await this.getAllActiveNotifications(client);

    return from(notifications).pipe(
      map((event) => ({ event: 'notification', data: event })),
    );
  }

  @SubscribeMessage('notifications/get-all-batch')
  async getAllActiveEventsBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { userIds?: Array<string> },
  ): Promise<Array<NotificationDocument | Record<string, unknown>>> {
    if (!socketToApiClient[client.id]) {
      return [];
    }

    // The bot sends the user ids it has sessions for and gets back, per
    // notification, which of them are eligible by current roles.
    return this.notificationsService.getAllActiveForBot(data?.userIds);
  }

  @SubscribeMessage('notifications/add-received')
  async addReceived(
    @MessageBody() data: { notificationId: string; token?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<boolean> {
    const { notificationId, token } = data || ({} as typeof data);

    let userId: string | undefined = socketToUser[client.id];
    const apiClient = socketToApiClient[client.id];
    if (!userId && token && apiClient?.name === process.env.BOT_CLIENT_NAME) {
      // NOTICE: only the authenticated bot may name a recipient. Its stored
      // session token may be expired, so only the userId is read from it;
      // eligibility is checked against current data in addReceived.
      const payload = await this.authService.decode(token);
      if (payload !== null && typeof payload === 'object' && payload.userId) {
        userId = String(payload.userId);
      }
    }

    if (userId) {
      return this.notificationsService.addReceived(notificationId, userId);
    }

    return false;
  }

  private async getAllActiveNotifications(
    client: Socket,
  ): Promise<Array<NotificationDocument>> {
    const apiClient = socketToApiClient[client.id];

    if (apiClient) {
      return this.notificationsService.getAllActive();
    }

    return [];
  }
}
