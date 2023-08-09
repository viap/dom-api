import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { UserDocument } from 'src/users/schemas/user.schema';

@Schema()
export class Client {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: UserDocument;

  @Prop({ required: true, default: '' })
  descr: string;
}

export const clientSchema = SchemaFactory.createForClass(Client);
