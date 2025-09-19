import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Contact, contactSchema } from 'src/common/schemas/contact.schema';
import { Role } from 'src/roles/enums/roles.enum';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ unique: true })
  login: string;

  @Prop()
  password: string;

  @Prop({ required: true, default: [Role.User] })
  roles: Array<Role>;

  @Prop()
  descr: string;

  @Prop({
    required: true,
    schema: contactSchema,
    default: [],
  })
  contacts: Array<Contact>;
}

export const userSchema = SchemaFactory.createForClass(User);

userSchema.index({ roles: 1 });
userSchema.index({ name: 'text' });
