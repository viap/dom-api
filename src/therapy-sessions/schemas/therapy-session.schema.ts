import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Price, priceSchema } from 'src/common/schemas/price.schema';
import { Psychologist } from 'src/psychologists/schemas/psychologist.schema';
import { User } from 'src/users/schemas/user.schema';

@Schema()
export class TherapySession {
  @Prop({ required: true })
  date: string;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  client: User;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Psychologist',
  })
  psychologist: Psychologist;

  @Prop({ required: true })
  duration: number;

  @Prop({ required: true, schema: priceSchema })
  price: Price;

  @Prop({ schema: priceSchema })
  comission: Price;

  @Prop()
  descr: string;
}

export type TherapySessionDocument = TherapySession & Document;
export const therapySessionSchema =
  SchemaFactory.createForClass(TherapySession);
