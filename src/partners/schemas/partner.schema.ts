import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Contact, contactSchema } from '@/common/schemas/contact.schema';
import { PartnerType } from '../enums/partner-type.enum';
import { PartnerLink, partnerLinkSchema } from './partner-link.schema';

export type PartnerDocument = Partner &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true })
export class Partner {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, enum: Object.values(PartnerType) })
  type: PartnerType;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Media' })
  logoId?: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true, schema: partnerLinkSchema, default: [] })
  links: Array<PartnerLink>;

  @Prop({ required: true, schema: contactSchema, default: [] })
  contacts: Array<Contact>;

  @Prop({ required: true, default: false })
  isPublished: boolean;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const partnerSchema = SchemaFactory.createForClass(Partner);
partnerSchema.index({ isPublished: 1, type: 1 });
partnerSchema.index({ title: 1 });
