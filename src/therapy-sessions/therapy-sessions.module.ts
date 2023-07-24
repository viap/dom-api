import { Module } from '@nestjs/common';
import { TherapySessionsService } from './therapy-sessions.service';
import { TherapySessionsController } from './therapy-sessions.controller';
import { PsychologistModule } from 'src/psychologists/psychologists.module';
import { ParticipantsModule } from 'src/participants/participants.module';

@Module({
  imports: [PsychologistModule, ParticipantsModule],
  providers: [TherapySessionsService],
  exports: [TherapySessionsService],
  controllers: [TherapySessionsController],
})
export class TherapySessionsModule {}
