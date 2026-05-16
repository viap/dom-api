import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Price, priceSchema } from '@/common/schemas/price.schema';

@Schema({ _id: false })
export class PersonService {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  title: string;

  @Prop({ required: true, type: [priceSchema], default: [] })
  prices: Array<Price>;
}

export const personServiceSchema = SchemaFactory.createForClass(PersonService);
