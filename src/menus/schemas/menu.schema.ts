import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { MenuItem, menuItemSchema } from './menu-item.schema';

export type MenuDocument = Menu &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true })
export class Menu {
  @Prop({ trim: true })
  key?: string;

  @Prop({ trim: true })
  title?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Page' })
  pageId?: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true, default: true })
  isActive: boolean;

  @Prop({ required: true, type: [menuItemSchema], default: [] })
  items: MenuItem[];

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const menuSchema = SchemaFactory.createForClass(Menu);
menuSchema.index(
  { key: 1 },
  {
    unique: true,
    partialFilterExpression: {
      key: { $exists: true, $type: 'string', $ne: '' },
    },
  },
);
menuSchema.index(
  { pageId: 1 },
  {
    unique: true,
    partialFilterExpression: { pageId: { $exists: true } },
  },
);
menuSchema.index({ isActive: 1, updatedAt: -1 });
