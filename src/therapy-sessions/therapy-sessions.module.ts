import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PsychologistsModule } from '@/psychologists/psychologists.module';
import { UsersModule } from '@/users/users.module';
import {
  TherapySession,
  therapySessionSchema,
} from './schemas/therapy-session.schema';
import {
  TherapyRequest,
  schemaTherapyRequest,
} from '@/therapy-requests/schemas/therapy-request.schema';
import { TherapySessionsController } from './therapy-sessions.controller';
import { TherapySessionsService } from './therapy-sessions.service';

@Module({
  imports: [
    UsersModule,
    PsychologistsModule,
    MongooseModule.forFeature([
      {
        name: TherapySession.name,
        schema: therapySessionSchema,
      },
      {
        name: TherapyRequest.name,
        schema: schemaTherapyRequest,
      },
    ]),
  ],
  providers: [TherapySessionsService],
  exports: [TherapySessionsService],
  controllers: [TherapySessionsController],
})
export class TherapySessionsModule {}
