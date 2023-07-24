import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Currency } from '../enums/currency.enum';
import { Education, educationSchema } from './education.schema';
import {
  SessionDuration,
  sessionDurationSchema,
} from './session-duration.schema';

export type PsychologistDocument = Psychologist & Document;

@Schema()
export class Psychologist {
  @Prop({
    required: true,
    enum: Object.values(Currency),
    default: Currency.Gel,
  })
  currency: Currency;

  @Prop({ required: true, schema: sessionDurationSchema, default: [] })
  sessionDurations: Array<SessionDuration>;

  @Prop({ required: true, schema: educationSchema, default: [] })
  education: Array<Education>;

  @Prop({ required: true, default: false })
  isInTheClub: boolean;
}

export const psychologistSchema = SchemaFactory.createForClass(Psychologist);
