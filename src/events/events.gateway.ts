import { OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Server, Socket } from 'socket.io';
import { ApiClientDto } from 'src/api-clients/dto/api-client.dto';
import { AuthService } from 'src/auth/auth.service';
import extractApiClientFromHeaders from 'src/common/utils/extract-api-client-from-headers';
import extractTokenFromHeaders from 'src/common/utils/extract-token-from-headers';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationDocument } from 'src/notifications/schemas/notification.schema';

const socketToUser: { [key: string]: string } = {};
const socketToApiClient: { [key: string]: ApiClientDto } = {};
const webSocketPort = process.env.WEBSOCKET_PORT
  ? parseInt(process.env.WEBSOCKET_PORT)
  : 3004;
@WebSocketGateway(webSocketPort, {
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnModuleInit {
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
        }
      } else if (initClient) {
        if (this.authService.isAvailableClient(initClient)) {
          socketToApiClient[client.id] = initClient;
          client.emit('inited', {
            clientId: client.id,
            apiClient: initClient.name,
          });
        }
      }
    });
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
    const apiClient = socketToApiClient[client.id];

    let notifications: Array<NotificationDocument> = [];
    if (apiClient) {
      notifications = await this.notificationsService.getAllActive();
    }

    return from(notifications).pipe(
      map((event) => ({ event: 'notification', data: event })),
    );
  }

  @SubscribeMessage('notifications/add-received')
  async addReceived(
    @MessageBody() data: { notificationId: string; token?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<boolean> {
    const { notificationId, token } = data;

    let userId: string | undefined = socketToUser[client.id];
    if (!userId && token) {
      const payload = await this.authService.verifyToken(token);
      userId = payload?.userId;
    }

    if (userId) {
      return this.notificationsService.addReceived(notificationId, userId);
    }
    return false;
  }
}
