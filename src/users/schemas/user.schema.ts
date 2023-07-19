import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  roles: Array<string>;

  @Prop()
  telegramId: string;

  @Prop()
  descr: string;

  @Prop()
  img: string;
}

export const userSchema = SchemaFactory.createForClass(User);
