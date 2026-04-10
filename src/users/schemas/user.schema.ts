import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Contact, contactSchema } from '@/common/schemas/contact.schema';
import { Role } from '@/roles/enums/roles.enum';
import { DEFAULT_TIMEZONE } from '@/common/const/timezone';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ unique: true })
  login: string;

  @Prop({ select: false })
  password: string;

  @Prop({ required: true, default: [Role.User] })
  roles: Array<Role>;

  @Prop()
  descr: string;

  @Prop({ trim: true, default: DEFAULT_TIMEZONE })
  timeZone: string;

  @Prop({
    required: true,
    schema: contactSchema,
    default: [],
  })
  contacts: Array<Contact>;
}

export const userSchema = SchemaFactory.createForClass(User);

// Transform function to ensure password is never included in JSON output
userSchema.set('toJSON', {
  transform: function (_, ret) {
    delete ret.password;
    return ret;
  },
});

userSchema.index({ roles: 1 });
userSchema.index({ name: 'text' });
