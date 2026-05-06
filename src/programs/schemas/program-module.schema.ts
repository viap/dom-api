import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class ProgramModule {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  order: number;

  @Prop()
  durationHours?: number;
}

export const programModuleSchema = SchemaFactory.createForClass(ProgramModule);
