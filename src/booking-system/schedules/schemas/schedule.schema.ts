import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { RoomDocument } from '../../rooms/schemas/room.schema';
import { CompanyDocument } from '../../companies/schemas/company.schema';

export type ScheduleDocument = Schedule & Document;

export enum ScheduleType {
  WORKING_HOURS = 'working_hours',
  UNAVAILABLE = 'unavailable',
}

export enum RecurrencePattern {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Schema({ timestamps: true })
export class Schedule {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ required: true, enum: ScheduleType })
  type: ScheduleType;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Room' })
  room: RoomDocument;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Company' })
  company: CompanyDocument;

  @Prop({ required: true })
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({
    required: true,
    enum: RecurrencePattern,
    default: RecurrencePattern.NONE,
  })
  recurrencePattern: RecurrencePattern;

  @Prop({ type: [Number], default: [] })
  daysOfWeek: number[];

  @Prop()
  recurrenceEndDate: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ trim: true, default: 'UTC' })
  timeZone: string;

  @Prop({ type: Object })
  metadata: {
    reason?: string;
    contactPerson?: string;
    priority?: number;
    color?: string;
  };
}

export const scheduleSchema = SchemaFactory.createForClass(Schedule);

// Enhanced indexes for performance optimization
scheduleSchema.index({ room: 1, startDate: 1, endDate: 1, isActive: 1 });
scheduleSchema.index({ company: 1, startDate: 1, endDate: 1, isActive: 1 });
scheduleSchema.index({ type: 1, isActive: 1, startDate: 1 });
scheduleSchema.index({ startDate: 1, endDate: 1, isActive: 1 });
scheduleSchema.index({ recurrencePattern: 1, isActive: 1 });
scheduleSchema.index({ room: 1, type: 1, isActive: 1 });
scheduleSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
