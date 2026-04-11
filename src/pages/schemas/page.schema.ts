import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { PageStatus } from '../enums/page-status.enum';

export type PageDocument = Page & Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true })
export class Page {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Domain' })
  domainId?: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true, trim: true })
  slug: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({
    required: true,
    enum: Object.values(PageStatus),
    default: PageStatus.Draft,
  })
  status: PageStatus;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  seo?: Record<string, string>;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const pageSchema = SchemaFactory.createForClass(Page);
pageSchema.index({ domainId: 1, slug: 1 }, { unique: true });
pageSchema.index({ domainId: 1, status: 1, updatedAt: -1 });
pageSchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { domainId: { $exists: false } },
  },
);
