import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TimezoneInterceptor } from './common/interceptors/timezone.interceptor';
import { UserContextInterceptor } from './common/user-context/user-context.interceptor';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiClientsModule } from './api-clients/api-clients.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { BookingSystemModule } from './booking-system/booking-system.module';
import { SanitizationMiddleware } from './common/middleware/sanitization.middleware';
import { WsModule } from './ws/ws.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PsychologistsModule } from './psychologists/psychologists.module';
import { RolesGuard } from './roles/roles.guard';
import { RolesModule } from './roles/roles.module';
import { TherapyRequestsModule } from './therapy-requests/therapy-requests.module';
import { TherapySessionsModule } from './therapy-sessions/therapy-sessions.module';
import { UsersModule } from './users/users.module';
import { cwd } from 'process';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: cwd() + '/config/.env',
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGO_URL, {
      dbName: process.env.MONGO_DBNAME,
      user: process.env.MONGO_INITDB_ROOT_USERNAME,
      pass: process.env.MONGO_INITDB_ROOT_PASSWORD,
    }),
    UsersModule,
    AuthModule,
    ApiClientsModule,
    RolesModule,
    PsychologistsModule,
    TherapySessionsModule,
    TherapyRequestsModule,
    WsModule,
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
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimezoneInterceptor,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SanitizationMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
