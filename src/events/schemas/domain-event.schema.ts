import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import {
  PriceGroup,
  priceGroupSchema,
} from '@/common/schemas/price-group.schema';
import { PageBlockType } from '@/pages/enums/page-block-type.enum';
import {
  applicationFormBlockSchema,
  ctaBlockSchema,
  entityCollectionBlockSchema,
  galleryBlockSchema,
  heroBlockSchema,
  htmlBlockSchema,
  pageBlockBaseSchema,
  richTextBlockSchema,
} from '@/pages/schemas/page-block.schema';
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

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, trim: true })
  slug: string;

  @Prop({ required: true })
  startAt: string;

  @Prop({ required: true })
  endAt: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Location' })
  locationId?: mongoose.Schema.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Media' })
  mediaId?: mongoose.Schema.Types.ObjectId;

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

  @Prop({
    type: [
      {
        time: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        note: { type: String, trim: true },
        _id: false,
      },
    ],
    default: [],
  })
  program: Array<{ time: string; title: string; note?: string }>;

  @Prop({ type: [String], default: [] })
  learnings: string[];

  @Prop({ type: [priceGroupSchema] })
  priceGroups?: PriceGroup[];

  @Prop({ min: 1 })
  capacity?: number;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  seo?: Record<string, string>;

  @Prop({ type: [pageBlockBaseSchema], default: [] })
  blocks: unknown[];

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const domainEventSchema = SchemaFactory.createForClass(DomainEvent);

const eventBlocksPath = domainEventSchema.path(
  'blocks',
) as mongoose.Schema.Types.DocumentArray;

eventBlocksPath.discriminator(PageBlockType.RichText, richTextBlockSchema);
eventBlocksPath.discriminator(
  PageBlockType.EntityCollection,
  entityCollectionBlockSchema,
);
eventBlocksPath.discriminator(PageBlockType.Hero, heroBlockSchema);
eventBlocksPath.discriminator(PageBlockType.Cta, ctaBlockSchema);
eventBlocksPath.discriminator(PageBlockType.Gallery, galleryBlockSchema);
eventBlocksPath.discriminator(
  PageBlockType.ApplicationForm,
  applicationFormBlockSchema,
);
eventBlocksPath.discriminator(PageBlockType.Html, htmlBlockSchema);

domainEventSchema.index({ mediaId: 1 }, { sparse: true });
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
domainEventSchema.index({ 'blocks.media.mediaId': 1 }, { sparse: true });
domainEventSchema.index(
  { 'blocks.backgroundMedia.mediaId': 1 },
  { sparse: true },
);
domainEventSchema.index({ 'blocks.items.mediaId': 1 }, { sparse: true });
