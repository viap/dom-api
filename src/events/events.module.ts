import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [EventsGateway],
  imports: [AuthModule, NotificationsModule],
})
export class EventsModule {}
