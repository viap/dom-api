import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApiClientsModule } from '../src/api-clients/api-clients.module';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthGuard } from '../src/auth/auth.guard';
import { AuthModule } from '../src/auth/auth.module';
import { BookingSystemModule } from '../src/booking-system/booking-system.module';
import { SanitizationMiddleware } from '../src/common/middleware/sanitization.middleware';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { PsychologistsModule } from '../src/psychologists/psychologists.module';
import { RolesGuard } from '../src/roles/roles.guard';
import { RolesModule } from '../src/roles/roles.module';
import { TherapyRequestsModule } from '../src/therapy-requests/therapy-requests.module';
import { TherapySessionsModule } from '../src/therapy-sessions/therapy-sessions.module';
import { UsersModule } from '../src/users/users.module';
import { cwd } from 'process';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: cwd() + '/config/.env',
      isGlobal: true,
    }),
    // No MongoDB connection - will be mocked in test setup
    UsersModule,
    AuthModule,
    ApiClientsModule,
    RolesModule,
    PsychologistsModule,
    TherapySessionsModule,
    TherapyRequestsModule,
    // EventsModule excluded to avoid WebSocket port conflicts
    NotificationsModule,
    BookingSystemModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class TestAppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SanitizationMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
