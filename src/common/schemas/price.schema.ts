import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Currencies } from '../../psychologists/enums/currencies.enum';

@Schema()
export class Price {
  @Prop({
    required: true,
    enum: Object.values(Currencies),
    default: Currencies.Gel,
  })
  currency: Currencies;

  @Prop({ required: true })
  value: number;
}

export const priceSchema = SchemaFactory.createForClass(Price);
