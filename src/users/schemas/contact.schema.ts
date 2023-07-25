import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class Contact {
  @Prop({ required: true })
  network: string;

  @Prop({ required: true })
  login: string;

  @Prop({ required: true, default: true })
  hidden: boolean;

  @Prop()
  id: string;
}

export const contactSchema = SchemaFactory.createForClass(Contact);
