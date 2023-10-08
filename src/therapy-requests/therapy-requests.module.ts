import { Module } from '@nestjs/common';
import { TherapyRequestsController } from './therapy-requests.controller';
import { TherapyRequestsService as TherapyRequestsService } from './therapy-requests.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TherapyRequest,
  schemaTherapyRequest,
} from './schemas/therapy-request.schema';
import { PsychologistsModule } from 'src/psychologists/psychologists.module';
import { UsersModule } from 'src/users/users.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

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
    ]),
  ],
  controllers: [TherapyRequestsController],
  providers: [TherapyRequestsService],
  exports: [TherapyRequestsService],
})
export class TherapyRequestsModule {}
