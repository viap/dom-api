import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PsychologistDocument } from '../../psychologists/schemas/psychologist.schema';
import mongoose, { Document } from 'mongoose';
import { Contact, contactSchema } from 'src/common/schemas/contact.schema';
import { UserDocument } from 'src/users/schemas/user.schema';

export type TherapyRequestDocument = TherapyRequest & Document;

@Schema()
export class TherapyRequest {
  @Prop({ required: true, default: Date.now() })
  timestamp: number;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: '' })
  descr: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Psychologist' })
  psychologist: PsychologistDocument;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: UserDocument;

  @Prop({
    required: true,
    schema: contactSchema,
    default: [],
  })
  contacts: Array<Contact>;

  @Prop({
    required: true,
    default: false,
  })
  accepted: boolean;
}

export const schemaTherapyRequest =
  SchemaFactory.createForClass(TherapyRequest);
