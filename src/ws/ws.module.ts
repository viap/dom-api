import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { NotificationsModule } from '@/notifications/notifications.module';

@Module({
  providers: [WsGateway],
  imports: [NotificationsModule],
})
export class WsModule {}
