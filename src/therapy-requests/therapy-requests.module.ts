import { Module } from '@nestjs/common';
import { TherapyRequestsController } from './therapy-requests.controller';
import { TherapyRequestsService as TherapyRequestsService } from './therapy-requests.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TherapyRequest,
  schemaTherapyRequest,
} from './schemas/therapy-request.schema';
import {
  TherapySession,
  therapySessionSchema,
} from '@/therapy-sessions/schemas/therapy-session.schema';
import {
  Psychologist,
  psychologistSchema,
} from '@/psychologists/schemas/psychologist.schema';
import { PsychologistsModule } from '@/psychologists/psychologists.module';
import { UsersModule } from '@/users/users.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { TherapyRequestClassifierService } from './therapy-request-classifier.service';
import { TherapyRequestAnalyticsController } from './therapy-request-analytics.controller';
import { TherapyRequestAnalyticsService } from './therapy-request-analytics.service';

@Module({
  imports: [
    UsersModule,
    PsychologistsModule,
    NotificationsModule,
    MongooseModule.forFeature([
      {
        name: TherapyRequest.name,
        schema: schemaTherapyRequest,
      },
      {
        name: TherapySession.name,
        schema: therapySessionSchema,
      },
      {
        name: Psychologist.name,
        schema: psychologistSchema,
      },
    ]),
  ],
  controllers: [TherapyRequestsController, TherapyRequestAnalyticsController],
  providers: [
    TherapyRequestsService,
    TherapyRequestClassifierService,
    TherapyRequestAnalyticsService,
  ],
  exports: [TherapyRequestsService],
})
export class TherapyRequestsModule {}
