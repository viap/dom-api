import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Currency } from '../enums/currency.enum';

type Price = {
  currency: Currency;
  value: number;
};

@Schema()
export class SessionDuration {
  @Prop({ require: true })
  alias: string;

  @Prop({ require: true })
  minutes: number;

  @Prop({ required: true })
  prices: Array<Price>;

  @Prop()
  descr: string;
}

export const sessionDurationSchema =
  SchemaFactory.createForClass(SessionDuration);
