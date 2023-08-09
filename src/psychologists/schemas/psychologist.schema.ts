import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { UserDocument } from 'src/users/schemas/user.schema';
import { Currencies } from '../enums/currencies.enum';
import { Client, clientSchema } from './clients.schema';
import { Education, educationSchema } from './education.schema';
import {
  SessionDuration,
  sessionDurationSchema,
} from './session-duration.schema';

export type PsychologistDocument = Psychologist & Document;

@Schema()
export class Psychologist {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: UserDocument;

  @Prop({
    required: true,
    enum: Object.values(Currencies),
    default: Currencies.Gel,
  })
  currency: Currencies;

  @Prop({ required: true, schema: sessionDurationSchema, default: [] })
  sessionDurations: Array<SessionDuration>;

  @Prop({ required: true, schema: educationSchema, default: [] })
  education: Array<Education>;

  @Prop({ required: true, default: false })
  isInTheClub: boolean;

  @Prop({
    required: true,
    schema: clientSchema,
    default: [],
  })
  clients: Array<Client>;
}

export const psychologistSchema = SchemaFactory.createForClass(Psychologist);
