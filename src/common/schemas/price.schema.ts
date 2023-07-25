import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Currency } from '../../psychologists/enums/currency.enum';

@Schema()
export class Price {
  @Prop({
    required: true,
    enum: Object.values(Currency),
    default: Currency.Gel,
  })
  currency: Currency;

  @Prop({ required: true })
  value: number;
}

export const priceSchema = SchemaFactory.createForClass(Price);
