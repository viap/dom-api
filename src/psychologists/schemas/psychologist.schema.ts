import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from 'src/users/schemas/user.schema';
import { Currency } from '../enums/currency.enum';
import { Education, educationSchema } from './education.schema';
import {
  SessionDuration,
  sessionDurationSchema,
} from './session-duration.schema';

export type PsychologistDocument = Psychologist & Document;

@Schema()
export class Psychologist {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

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

  @Prop({
    required: true,
    type: mongoose.Schema.Types.Map,
    of: String,
    default: {},
  })
  contacts: mongoose.Schema.Types.Map;
}

export const psychologistSchema = SchemaFactory.createForClass(Psychologist);
