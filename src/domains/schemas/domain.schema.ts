import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { DomainCode } from '../enums/domain-code.enum';

export type DomainDocument = Domain &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true })
export class Domain {
  @Prop({ required: true, unique: true, enum: Object.values(DomainCode) })
  code: DomainCode;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({ required: true, default: 0 })
  order: number;

  @Prop({ type: Object, default: {} })
  seo: Record<string, string>;
}

export const domainSchema = SchemaFactory.createForClass(Domain);
domainSchema.index({ code: 1 }, { unique: true });
domainSchema.index({ slug: 1 }, { unique: true });
domainSchema.index({ isActive: 1, order: 1 });
