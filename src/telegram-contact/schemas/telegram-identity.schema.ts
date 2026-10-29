import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

export type TelegramIdentityDocument = TelegramIdentity & Document;

@Schema({ timestamps: true })
export class TelegramIdentity {
  @Prop({ required: true, trim: true })
  telegramUserId: string;

  @Prop({ required: true, trim: true })
  privateChatId: string;

  @Prop({ trim: true })
  username?: string;

  @Prop({ trim: true, maxlength: 129 })
  displayName?: string;

  @Prop({ required: true })
  verifiedAt: Date;

  @Prop({ required: true })
  lastSeenAt: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  userId?: mongoose.Types.ObjectId;
}

export const telegramIdentitySchema =
  SchemaFactory.createForClass(TelegramIdentity);

telegramIdentitySchema.index({ telegramUserId: 1 }, { unique: true });
telegramIdentitySchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } },
  },
);
