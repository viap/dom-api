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
import { AuthService } from 'src/auth/auth.service';
import extractTokenFromHeaders from 'src/common/utils/extract-token-from-headers';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationDocument } from 'src/notifications/schemas/notification.schema';

const socketToUser: { [key: string]: string } = {};
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
    this.server.on('connection', async (socket: Socket) => {
      // NOTICE: authorisation by token
      const token = extractTokenFromHeaders(socket.handshake.headers);
      if (token) {
        const payload = await this.authService.verifyToken(token);
        if (payload?.userId) {
          socketToUser[socket.id] = payload.userId;
          socket.emit('inited', { id: socket.id });
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

  @SubscribeMessage('notifications')
  async getEvents(
    @ConnectedSocket() client: Socket,
  ): Promise<Observable<WsResponse<NotificationDocument>> | never> {
    const userId = socketToUser[client.id];
    if (userId) {
      const notifications = await this.notificationsService.getAllByUserId(
        userId,
      );
      return from(notifications).pipe(
        map((event) => ({ event: 'notification', data: event })),
      );
    }
  }

  @SubscribeMessage('notifications/add-received')
  async addReceived(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<boolean> {
    const { notificationId } = data;
    const userId = socketToUser[client.id];
    if (notificationId && userId) {
      return this.notificationsService.addReceived(notificationId, userId);
    }
    return false;
  }
}
