import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop()
  telegramId: string;

  @Prop()
  name: string;

  @Prop()
  descr: string;

  @Prop({
    required: false,
  })
  img: string;

  @Prop()
  roles: Array<string>;
}

export const userSchema = SchemaFactory.createForClass(User);
