import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MenuItemType } from '../enums/menu-item-type.enum';

@Schema({ _id: false, id: false })
export class MenuItem {
  @Prop({ required: true, trim: true })
  id: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, enum: Object.values(MenuItemType) })
  type: MenuItemType;

  @Prop()
  targetId?: string;

  @Prop()
  url?: string;

  @Prop({ required: true, min: 0 })
  order: number;

  @Prop({ required: true, default: true })
  isVisible: boolean;

  @Prop({ required: true, default: false })
  openInNewTab: boolean;

  @Prop({ default: [] })
  children: MenuItem[];
}

export const menuItemSchema = SchemaFactory.createForClass(MenuItem);
menuItemSchema.remove('children');
menuItemSchema.add({
  children: { type: [menuItemSchema], default: [] },
});
