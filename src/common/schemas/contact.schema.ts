import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class Contact {
  @Prop()
  id: string;

  @Prop({ required: true })
  network: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true, default: false })
  hidden: boolean;
}

export const contactSchema = SchemaFactory.createForClass(Contact);
