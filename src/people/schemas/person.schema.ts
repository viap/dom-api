import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Contact, contactSchema } from '@/common/schemas/contact.schema';
import { UserDocument } from '@/users/schemas/user.schema';
import {
  PersonSocialLink,
  personSocialLinkSchema,
} from './person-social-link.schema';
import { PersonRole } from '../enums/person-role.enum';

export type PersonDocument = Person &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true })
export class Person {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  userId?: UserDocument;

  @Prop({ trim: true, minlength: 1 })
  slug?: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ type: [String], enum: Object.values(PersonRole), default: [] })
  roles: PersonRole[];

  @Prop({ default: '' })
  bio: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Media' })
  photoId?: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true, schema: contactSchema, default: [] })
  contacts: Array<Contact>;

  @Prop({ required: true, schema: personSocialLinkSchema, default: [] })
  socialLinks: Array<PersonSocialLink>;

  @Prop({ required: true, default: false })
  isPublished: boolean;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const personSchema = SchemaFactory.createForClass(Person);
personSchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: {
      slug: { $exists: true, $type: 'string', $gt: '' },
    },
  },
);
personSchema.index({ isPublished: 1, fullName: 1 });
personSchema.index({ userId: 1 }, { sparse: true });
