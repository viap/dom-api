import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LocationDocument = Location &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true })
export class Location {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({
    type: {
      lat: { type: Number },
      lng: { type: Number },
    },
    _id: false,
  })
  geo?: { lat: number; lng: number };

  @Prop({ trim: true, default: '' })
  notes: string;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const locationSchema = SchemaFactory.createForClass(Location);
locationSchema.index({ title: 1 });
locationSchema.index({ city: 1, title: 1 });
