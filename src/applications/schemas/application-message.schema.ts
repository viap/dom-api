import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import {
  ApplicationMessageDirection,
  ApplicationMessageStatus,
} from '../enums/application-message.enum';

export type ApplicationMessageDocument = ApplicationMessage &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: 'application_messages' })
export class ApplicationMessage {
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
  })
  applicationId: mongoose.Types.ObjectId;

  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TelegramIdentity',
  })
  telegramIdentityId: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: Object.values(ApplicationMessageDirection) })
  direction: ApplicationMessageDirection;

  @Prop({ required: true, trim: true, maxlength: 3500 })
  text: string;

  @Prop({ required: true, enum: Object.values(ApplicationMessageStatus) })
  status: ApplicationMessageStatus;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  senderUserId?: mongoose.Types.ObjectId;

  @Prop({ trim: true, maxlength: 129 })
  senderDisplayName?: string;

  @Prop({ trim: true })
  clientMessageId?: string;

  @Prop()
  telegramMessageId?: number;

  @Prop()
  replyToTelegramMessageId?: number;

  @Prop({ trim: true, maxlength: 100 })
  deliveryErrorCode?: string;

  @Prop()
  claimedAt?: Date;

  @Prop()
  sentAt?: Date;

  @Prop()
  receivedAt?: Date;
}

export const applicationMessageSchema =
  SchemaFactory.createForClass(ApplicationMessage);

applicationMessageSchema.index({ applicationId: 1, createdAt: 1 });
applicationMessageSchema.index({ status: 1, createdAt: 1 });
applicationMessageSchema.index(
  { clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: 'string' } },
  },
);
applicationMessageSchema.index(
  { telegramIdentityId: 1, telegramMessageId: 1, direction: 1 },
  {
    unique: true,
    partialFilterExpression: { telegramMessageId: { $type: 'number' } },
  },
);
