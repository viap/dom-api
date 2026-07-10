import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PsychologistDocument } from '../../psychologists/schemas/psychologist.schema';
import mongoose, { Document } from 'mongoose';
import { Contact, contactSchema } from '@/common/schemas/contact.schema';
import { UserDocument } from '@/users/schemas/user.schema';
import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from '../enums/therapy-request-analytics.enum';
import {
  AnalyticsInference,
  analyticsInferenceSchema,
} from './analytics-inference.schema';

@Schema({ timestamps: true })
export class TherapyRequest {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: '' })
  descr: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Psychologist' })
  psychologist: PsychologistDocument;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: UserDocument;

  @Prop({
    required: true,
    schema: contactSchema,
    default: [],
  })
  contacts: Array<Contact>;

  @Prop({
    required: true,
    default: false,
  })
  accepted: boolean;

  @Prop({
    required: true,
    enum: Object.values(TherapyRequestClientGender),
    default: TherapyRequestClientGender.Unknown,
  })
  clientGender: TherapyRequestClientGender;

  @Prop({
    required: true,
    enum: Object.values(TherapyRequestCategory),
    default: TherapyRequestCategory.Unknown,
  })
  requestCategory: TherapyRequestCategory;

  @Prop({ required: true, default: true })
  analyticsReviewRequired: boolean;

  @Prop({ schema: analyticsInferenceSchema, default: {} })
  analyticsInference: AnalyticsInference;
}

export type TherapyRequestDocument = TherapyRequest &
  Document & { createdAt: Date; updatedAt: Date };
export const schemaTherapyRequest =
  SchemaFactory.createForClass(TherapyRequest);

schemaTherapyRequest.index({ psychologist: 1, createdAt: 1 });
schemaTherapyRequest.index({ user: 1, createdAt: 1 });
schemaTherapyRequest.index({ accepted: 1, createdAt: 1 });
schemaTherapyRequest.index({ createdAt: 1 });
schemaTherapyRequest.index({ clientGender: 1, createdAt: 1 });
schemaTherapyRequest.index({ requestCategory: 1, createdAt: 1 });
