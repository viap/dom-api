import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { User } from 'src/users/schemas/user.schema';

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

export const educationSchema = SchemaFactory.createForClass(User);
