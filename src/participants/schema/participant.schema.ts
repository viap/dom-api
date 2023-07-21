import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

export type ParticipantDocument = Participant & Document;

@Schema()
export class Participant {
  @Prop({ required: true })
  name: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: mongoose.Schema.Types.ObjectId;

  @Prop({ default: '' })
  descr: string;

  @Prop({
    type: mongoose.Schema.Types.Map,
    of: String,
    default: {},
  })
  contacts: mongoose.Schema.Types.Map;
}

export const participantSchema = SchemaFactory.createForClass(Participant);
