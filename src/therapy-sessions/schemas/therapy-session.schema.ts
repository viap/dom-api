import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Price, priceSchema } from 'src/common/schemas/price.schema';
import { PsychologistDocument } from 'src/psychologists/schemas/psychologist.schema';
import { UserDocument } from 'src/users/schemas/user.schema';

@Schema()
export class TherapySession {
  @Prop({ required: true })
  date: string;

  @Prop({ required: true, default: Date.now() })
  timestamp: number;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  client: UserDocument;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Psychologist',
  })
  psychologist: PsychologistDocument;

  @Prop({ required: true })
  duration: number;

  @Prop({ required: true, schema: priceSchema })
  price: Price;

  @Prop({ schema: priceSchema })
  comission: Price;

  @Prop({ default: '' })
  descr: string;
}

export type TherapySessionDocument = TherapySession & Document;
export const therapySessionSchema =
  SchemaFactory.createForClass(TherapySession);
