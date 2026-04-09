import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [WsGateway],
  imports: [AuthModule, NotificationsModule],
})
export class WsModule {}
