import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/users/users.module';
import { PsychologistsController } from './psychologists.controller';
import { PsychologistsService } from './psychologists.service';
import {
  Psychologist,
  psychologistSchema,
} from './schemas/psychologist.schema';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      {
        name: Psychologist.name,
        schema: psychologistSchema,
      },
    ]),
  ],
  providers: [PsychologistsService],
  controllers: [PsychologistsController],
  exports: [PsychologistsService],
})
export class PsychologistsModule {}
