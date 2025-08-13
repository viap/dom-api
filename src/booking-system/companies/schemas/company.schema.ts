import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyDocument = Company & Document;

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ trim: true })
  phone: string;

  @Prop({ trim: true })
  email: string;

  @Prop({ trim: true })
  website: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Object })
  settings: {
    defaultBookingDuration?: number;
    advanceBookingDays?: number;
    cancellationPolicy?: string;
    timeZone?: string;
  };
}

export const companySchema = SchemaFactory.createForClass(Company);

companySchema.index({ name: 1 });
companySchema.index({ isActive: 1 });
