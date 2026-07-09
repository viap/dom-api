import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class AnalyticsFieldInference {
  @Prop({ required: true, default: '' })
  value: string;

  @Prop({ required: true, default: 0 })
  confidence: number;

  @Prop({ required: true, default: [] })
  sources: Array<string>;

  @Prop({ required: true, default: [] })
  reasons: Array<string>;

  @Prop()
  detectedAt?: Date;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  reviewedBy?: string;

  @Prop({ required: true, default: false })
  manual: boolean;

  @Prop({ required: true, default: false })
  selfReported?: boolean;
}

export const analyticsFieldInferenceSchema = SchemaFactory.createForClass(
  AnalyticsFieldInference,
);

@Schema({ _id: false })
export class AnalyticsInference {
  @Prop({ schema: analyticsFieldInferenceSchema })
  clientGender?: AnalyticsFieldInference;

  @Prop({ schema: analyticsFieldInferenceSchema })
  requestCategory?: AnalyticsFieldInference;

  @Prop({ schema: analyticsFieldInferenceSchema })
  topic?: AnalyticsFieldInference;
}

export const analyticsInferenceSchema =
  SchemaFactory.createForClass(AnalyticsInference);
