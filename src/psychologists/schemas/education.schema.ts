import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class Education {
  @Prop({ require: true })
  title: string;

  @Prop({ require: true })
  author: string;

  @Prop()
  hours: number;

  @Prop()
  startDate: Date;

  @Prop()
  endDate: Date;
}

export const educationSchema = SchemaFactory.createForClass(Education);
