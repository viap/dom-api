import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { PartnerType } from '../enums/partner-type.enum';

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

  @Prop({ trim: true })
  website?: string;

  @Prop({
    type: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    _id: false,
  })
  contactPerson?: { name?: string; email?: string; phone?: string };

  @Prop({ required: true, default: false })
  isPublished: boolean;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const partnerSchema = SchemaFactory.createForClass(Partner);
partnerSchema.index({ isPublished: 1, type: 1 });
partnerSchema.index({ title: 1 });
