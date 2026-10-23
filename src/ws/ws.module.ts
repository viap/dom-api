import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { NotificationsModule } from '@/notifications/notifications.module';
import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';

@Module({
  providers: [WsGateway],
  imports: [AuthModule, NotificationsModule, UsersModule],
})
export class WsModule {}
