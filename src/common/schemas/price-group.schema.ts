import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Price, priceSchema } from './price.schema';

@Schema({ _id: false })
export class PriceGroup {
  @Prop({ trim: true })
  title?: string;

  @Prop({ type: Date })
  deadline?: Date;

  @Prop({ required: true, type: priceSchema })
  price: Price;
}

export const priceGroupSchema = SchemaFactory.createForClass(PriceGroup);
