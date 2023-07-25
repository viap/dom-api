import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Price, priceSchema } from '../../common/schemas/price.schema';

@Schema()
export class SessionDuration {
  @Prop({ require: true })
  alias: string;

  @Prop({ require: true })
  minutes: number;

  @Prop({ required: true, schema: priceSchema })
  prices: Array<Price>;

  @Prop()
  descr: string;
}

export const sessionDurationSchema =
  SchemaFactory.createForClass(SessionDuration);
