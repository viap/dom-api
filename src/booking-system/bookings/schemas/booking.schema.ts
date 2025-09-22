import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { UserDocument } from '../../../users/schemas/user.schema';
import { RoomDocument } from '../../rooms/schemas/room.schema';
import { BookingStatus } from '../enums/booking-status.enum';
import { RecurrenceType } from '../enums/recurrence-type.enum';

export type BookingDocument = Booking &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true })
export class Booking {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'Room' })
  room: RoomDocument;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  bookedBy: UserDocument;

  @Prop({ required: true })
  startDateTime: Date;

  @Prop({ required: true })
  endDateTime: Date;

  @Prop({ required: true, enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  approvedBy: UserDocument;

  @Prop()
  approvedAt: Date;

  @Prop({ trim: true })
  cancellationReason: string;

  @Prop()
  canceledAt: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' })
  parentBooking: BookingDocument;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
    default: [],
  })
  childBookings: BookingDocument[];

  @Prop({ required: true, enum: RecurrenceType, default: RecurrenceType.NONE })
  recurrenceType: RecurrenceType;

  @Prop()
  recurrenceEndDate: Date;

  @Prop({ type: [Number], default: [] })
  daysOfWeek: number[];

  @Prop({ default: 1 })
  recurrenceInterval: number;

  @Prop({ type: [String], default: [] })
  attendees: string[];

  @Prop({ trim: true, default: 'UTC' })
  timeZone: string;

  @Prop({ type: Object })
  metadata: {
    purpose?: string;
    department?: string;
    contactEmail?: string;
    contactPhone?: string;
    specialRequirements?: string;
    estimatedAttendees?: number;
    isPrivate?: boolean;
    color?: string;
    priority?: number;
  };

  @Prop({ type: Object })
  equipmentRequests: {
    projector?: boolean;
    microphone?: boolean;
    videoConferencing?: boolean;
    catering?: boolean;
    whiteboard?: boolean;
    flipChart?: boolean;
    other?: string[];
  };
}

export const bookingSchema = SchemaFactory.createForClass(Booking);

// Enhanced compound indexes for performance optimization
bookingSchema.index({ room: 1, startDateTime: 1, endDateTime: 1, status: 1 });
bookingSchema.index({ bookedBy: 1, startDateTime: 1, status: 1 });
bookingSchema.index({ status: 1, startDateTime: 1 });
bookingSchema.index({ startDateTime: 1, endDateTime: 1 });
bookingSchema.index({ parentBooking: 1 }, { sparse: true });
bookingSchema.index({ recurrenceType: 1 });

// Additional performance indexes
bookingSchema.index({ status: 1, createdAt: 1 });
bookingSchema.index({ room: 1, status: 1, startDateTime: 1 });
bookingSchema.index({ bookedBy: 1, status: 1, startDateTime: -1 });
bookingSchema.index({ startDateTime: 1, status: 1 });
bookingSchema.index({ endDateTime: 1, status: 1 });
