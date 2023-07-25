import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PsychologistsModule } from 'src/psychologists/psychologists.module';
import { UsersModule } from 'src/users/users.module';
import {
  TherapySession,
  therapySessionSchema,
} from './schemas/therapy-session.schema';
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
    ]),
  ],
  providers: [TherapySessionsService],
  exports: [TherapySessionsService],
  controllers: [TherapySessionsController],
})
export class TherapySessionsModule {}
