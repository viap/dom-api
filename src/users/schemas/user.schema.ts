import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Contact, contactSchema } from 'src/common/schemas/contact.schema';
import { Role } from 'src/roles/roles.enum';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true })
  name: string;

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
