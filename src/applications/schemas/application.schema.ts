import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Contact, contactSchema } from '@/common/schemas/contact.schema';
import { UserDocument } from '@/users/schemas/user.schema';
import { ApplicationFormType } from '../enums/application-form-type.enum';
import { ApplicationStatus } from '../enums/application-status.enum';
import {
  PreferredContact,
  PreferredContactType,
} from '../types/preferred-contact.type';

export type ApplicationDocument = Application &
  Document & { createdAt: Date; updatedAt: Date };

const preferredContactSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: Object.values(PreferredContactType),
    },
    username: { type: String },
    verification: { type: String, enum: ['unverified'] },
    identityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelegramIdentity',
    },
    usernameSnapshot: { type: String },
    verifiedAt: { type: String },
    phoneE164: { type: String },
    whatsappAvailable: { type: Boolean },
  },
  { _id: false, strict: true },
);

const applicationApplicantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contacts: { type: [contactSchema], required: true, default: [] },
    preferredContact: { type: preferredContactSchema },
  },
  { _id: false, strict: true },
);

@Schema({ timestamps: true })
export class Application {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'Domain' })
  domainId: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true, enum: Object.values(ApplicationFormType) })
  formType: ApplicationFormType;

  @Prop({
    type: {
      entityType: { type: String },
      entityId: { type: mongoose.Schema.Types.ObjectId },
      utm: { type: Map, of: String },
    },
    _id: false,
  })
  source?: {
    entityType?: string;
    entityId?: mongoose.Schema.Types.ObjectId;
    utm?: Record<string, string>;
  };

  @Prop({
    required: true,
    type: applicationApplicantSchema,
  })
  applicant: {
    name: string;
    contacts: Array<Contact>;
    preferredContact?: PreferredContact;
  };

  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({
    required: true,
    enum: Object.values(ApplicationStatus),
    default: ApplicationStatus.New,
  })
  status: ApplicationStatus;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  assignedTo?: UserDocument;

  @Prop({
    required: true,
    type: [
      {
        text: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, required: true },
        createdAt: { type: String, required: true },
      },
    ],
    default: [],
  })
  notes: Array<{
    text: string;
    authorId: mongoose.Schema.Types.ObjectId;
    createdAt: string;
  }>;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const applicationSchema = SchemaFactory.createForClass(Application);
applicationSchema.index({ domainId: 1, formType: 1, status: 1, createdAt: -1 });
applicationSchema.index(
  { assignedTo: 1, status: 1, createdAt: -1 },
  { sparse: true },
);
applicationSchema.index({ 'source.entityType': 1, 'source.entityId': 1 });
