import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MediaKind } from '../enums/media-kind.enum';

export type MediaDocument = Media &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true })
export class Media {
  @Prop({ required: true, enum: Object.values(MediaKind) })
  kind: MediaKind;

  @Prop({ trim: true })
  storageKey?: string;

  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ trim: true, default: '' })
  title: string;

  @Prop({ trim: true })
  mimeType?: string;

  @Prop()
  sizeBytes?: number;

  @Prop({ trim: true, default: '' })
  alt: string;

  @Prop({ trim: true })
  folder?: string;

  @Prop()
  width?: number;

  @Prop()
  height?: number;

  @Prop({ required: true, default: false })
  isPublished: boolean;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const mediaSchema = SchemaFactory.createForClass(Media);
mediaSchema.index({ storageKey: 1 }, { unique: true, sparse: true });
mediaSchema.index({ isPublished: 1, createdAt: -1 });
