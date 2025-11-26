import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { CompanyDocument } from '../../companies/schemas/company.schema';
import { Role } from '../../../roles/enums/roles.enum';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description: string;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
  })
  company: CompanyDocument;

  @Prop({ required: true, min: 1 })
  capacity: number;

  @Prop({ type: [String], default: [] })
  amenities: string[];

  @Prop({ trim: true })
  location: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], enum: Role, default: [] })
  allowedRoles: Role[];

  @Prop({ type: Object })
  settings: {
    allowMultipleBookings?: boolean;
    minimumBookingDuration?: number;
    maximumBookingDuration?: number;
    cleaningTimeAfterBooking?: number;
    advanceNoticeRequired?: number;
  };

  @Prop({ type: Object })
  equipment: {
    projector?: boolean;
    whiteboard?: boolean;
    audioSystem?: boolean;
    videoConferencing?: boolean;
    wifi?: boolean;
    airConditioning?: boolean;
    other?: string[];
  };
}

export const roomSchema = SchemaFactory.createForClass(Room);

// Enhanced indexes for performance optimization
roomSchema.index({ company: 1, name: 1 }, { unique: true });
roomSchema.index({ company: 1, isActive: 1 });
roomSchema.index({ isActive: 1, capacity: 1 });
roomSchema.index({ capacity: 1 });
roomSchema.index({ company: 1, isActive: 1, capacity: 1 });
