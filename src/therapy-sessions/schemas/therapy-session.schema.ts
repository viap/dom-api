import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Participant } from 'src/participants/schema/participant.schema';
import { Psychologist } from 'src/psychologists/schemas/psychologist.schema';
import {
  SessionDuration,
  sessionDurationSchema,
} from 'src/psychologists/schemas/session-duration.schema';

// - Дата и время
// - Участник()
// - Психолог()
// - Длительность: один, полтора, два часа
// - Стоимость
// - Оплата центру
// - Кабинет - ?
// - Протокол - ?
// - Файлы - ?

@Schema()
export class TherapySession {
  @Prop({ required: true, default: Date.now() })
  date: Date;

  @Prop({ required: true, ref: 'Participant' })
  participant: Participant;

  @Prop({ required: true, ref: 'Psychologist' })
  psychologist: Psychologist;

  @Prop({ required: true, schema: sessionDurationSchema })
  sessionDuration: SessionDuration;

  @Prop({ required: true, default: 0 })
  comission: number;

  @Prop()
  cabinet: string;

  @Prop()
  descr: string;
}

export type TherapySessionDocument = TherapySession & Document;
export const therapySessionSchema =
  SchemaFactory.createForClass(TherapySession);
