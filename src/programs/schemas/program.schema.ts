import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Price, priceSchema } from '@/common/schemas/price.schema';
import { ProgramFormat } from '../enums/program-format.enum';
import { ProgramKind } from '../enums/program-kind.enum';
import { ProgramStatus } from '../enums/program-status.enum';
import { ProgramModule, programModuleSchema } from './program-module.schema';

export type ProgramDocument = Program &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true })
export class Program {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'Domain' })
  domainId: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true, enum: Object.values(ProgramKind) })
  kind: ProgramKind;

  @Prop({
    required: true,
    enum: Object.values(ProgramStatus),
    default: ProgramStatus.Draft,
  })
  status: ProgramStatus;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  slug: string;

  @Prop()
  startDate?: number;

  @Prop()
  endDate?: number;

  @Prop()
  applicationDeadline?: number;

  @Prop({ required: true, enum: Object.values(ProgramFormat) })
  format: ProgramFormat;

  @Prop({ schema: priceSchema })
  price?: Price;

  @Prop({ required: true, schema: programModuleSchema, default: [] })
  modules: Array<ProgramModule>;

  @Prop({
    required: true,
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
    default: [],
  })
  speakerIds: mongoose.Schema.Types.ObjectId[];

  @Prop({
    required: true,
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
    default: [],
  })
  organizerIds: mongoose.Schema.Types.ObjectId[];

  @Prop({
    required: true,
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Partner' }],
    default: [],
  })
  partnerIds: mongoose.Schema.Types.ObjectId[];

  @Prop({ required: true, default: 1 })
  schemaVersion: number;
}

export const programSchema = SchemaFactory.createForClass(Program);
programSchema.index({ domainId: 1, slug: 1 }, { unique: true });
programSchema.index({ domainId: 1, status: 1, startDate: 1 });
programSchema.index(
  { domainId: 1, startDate: 1 },
  { partialFilterExpression: { status: ProgramStatus.Upcoming } },
);
programSchema.index(
  { domainId: 1, startDate: 1 },
  { partialFilterExpression: { status: ProgramStatus.Active } },
);
