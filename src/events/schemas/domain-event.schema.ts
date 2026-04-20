import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import {
  PriceGroup,
  priceGroupSchema,
} from '@/common/schemas/price-group.schema';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';

export type DomainEventDocument = DomainEvent &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: 'events' })
export class DomainEvent {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'Domain' })
  domainId: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true, enum: Object.values(EventType) })
  type: EventType;

  @Prop({
    required: true,
    enum: Object.values(EventStatus),
    default: EventStatus.Draft,
  })
  status: EventStatus;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  slug: string;

  @Prop({ required: true })
  startAt: string;

  @Prop({ required: true })
  endAt: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Location' })
  locationId?: mongoose.Schema.Types.ObjectId;

  @Prop({
    required: true,
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
    default: [],
  })
  speakerIds: mongoose.Schema.Types.ObjectId[];

  @Prop({
    required: true,
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
    default: [],
  })
  organizerIds: mongoose.Schema.Types.ObjectId[];

  @Prop({
    required: true,
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Partner' }],
    default: [],
  })
  partnerIds: mongoose.Schema.Types.ObjectId[];

  @Prop({
    required: true,
    type: {
      isOpen: { type: Boolean, default: false },
      maxParticipants: { type: Number },
      deadline: { type: String },
    },
    _id: false,
    default: { isOpen: false },
  })
  registration: {
    isOpen: boolean;
    maxParticipants?: number;
    deadline?: string;
  };

  @Prop({ type: [priceGroupSchema] })
  priceGroups?: PriceGroup[];

  @Prop({ min: 1 })
  capacity?: number;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const domainEventSchema = SchemaFactory.createForClass(DomainEvent);
domainEventSchema.index({ domainId: 1, slug: 1 }, { unique: true });
domainEventSchema.index({ domainId: 1, status: 1, startAt: 1 });
domainEventSchema.index(
  { domainId: 1, startAt: 1 },
  { partialFilterExpression: { status: EventStatus.Planned } },
);
domainEventSchema.index(
  { domainId: 1, startAt: 1 },
  { partialFilterExpression: { status: EventStatus.RegistrationOpen } },
);
