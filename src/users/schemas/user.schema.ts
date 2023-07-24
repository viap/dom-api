import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Psychologist } from 'src/psychologists/schemas/psychologist.schema';
import { Role } from 'src/roles/roles.enum';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: [Role.User] })
  roles: Array<Role>;

  @Prop()
  telegramId: string;

  @Prop()
  descr: string;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.Map,
    of: String,
    default: {},
  })
  contacts: mongoose.Schema.Types.Map;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Psychologist' })
  psychologist: Psychologist;
}

export const userSchema = SchemaFactory.createForClass(User);
