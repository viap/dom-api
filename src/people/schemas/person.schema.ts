import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Contact, contactSchema } from '@/common/schemas/contact.schema';
import { UserDocument } from '@/users/schemas/user.schema';
import {
  PersonSocialLink,
  personSocialLinkSchema,
} from './person-social-link.schema';
import { PersonRole } from '../enums/person-role.enum';
import { WorkFormat } from '../enums/work-format.enum';
import { Languages } from '../enums/languages.enum';
import { PersonAvailability } from '../enums/person-availability.enum';
import { PersonService, personServiceSchema } from './person-service.schema';

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

  @Prop({ trim: true, maxlength: 150 })
  title?: string;

  @Prop({ type: [String], enum: Object.values(PersonRole), default: [] })
  roles: PersonRole[];

  @Prop({ default: '' })
  bio: string;

  @Prop({ required: true, trim: true, default: '' })
  education: string;

  @Prop({ required: true, trim: true, default: '' })
  experience: string;

  @Prop({ required: true, type: [personServiceSchema], default: [] })
  services: Array<PersonService>;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Location' })
  workLocationId?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: [String], default: [] })
  specializations: string[];

  @Prop({
    required: true,
    type: [
      {
        _id: false,
        startDate: { type: String, trim: true },
        endDate: { type: String, trim: true },
        institution: {
          type: String,
          required: true,
          trim: true,
          maxlength: 200,
        },
        detail: { type: String, trim: true, maxlength: 500 },
      },
    ],
    default: [],
  })
  educationItems: Array<{
    startDate?: string;
    endDate?: string;
    institution: string;
    detail?: string;
  }>;

  @Prop({
    required: true,
    type: [
      {
        _id: false,
        startDate: { type: String, trim: true },
        endDate: { type: String, trim: true },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        organization: { type: String, trim: true, maxlength: 200 },
        detail: { type: String, trim: true, maxlength: 700 },
      },
    ],
    default: [],
  })
  experienceItems: Array<{
    startDate?: string;
    endDate?: string;
    title: string;
    organization?: string;
    detail?: string;
  }>;

  @Prop({ type: String, enum: Object.values(PersonAvailability) })
  availability?: PersonAvailability;

  @Prop({ type: [String], enum: Object.values(WorkFormat), default: [] })
  workFormat: WorkFormat[];

  @Prop({
    type: [String],
    enum: Object.values(Languages),
    default: [Languages.Ru],
  })
  languages: Languages[];

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
personSchema.index({ photoId: 1 }, { sparse: true });
personSchema.index({ isPublished: 1, fullName: 1 });
personSchema.index({ userId: 1 }, { sparse: true });
personSchema.index({ workLocationId: 1 }, { sparse: true });
