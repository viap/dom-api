import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { TelegramLinkStatus } from '@/telegram-contact/enums/telegram-link-status.enum';

export type TelegramLinkSessionDocument = TelegramLinkSession & Document;

@Schema({ timestamps: true })
export class TelegramLinkSession {
  @Prop({ required: true })
  publicId: string;

  @Prop({ required: true, select: false })
  startTokenHash: string;

  @Prop({ required: true, select: false })
  browserProofHash: string;

  @Prop({
    required: true,
    enum: Object.values(TelegramLinkStatus),
    default: TelegramLinkStatus.Pending,
  })
  status: TelegramLinkStatus;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'TelegramIdentity' })
  identityId?: mongoose.Types.ObjectId;

  @Prop()
  linkedAt?: Date;

  @Prop()
  consumedAt?: Date;

  @Prop()
  confirmationClaimedAt?: Date;

  @Prop({ required: true })
  expiresAt: Date;
}

export const telegramLinkSessionSchema =
  SchemaFactory.createForClass(TelegramLinkSession);

telegramLinkSessionSchema.index({ publicId: 1 }, { unique: true });
telegramLinkSessionSchema.index({ startTokenHash: 1 }, { unique: true });
telegramLinkSessionSchema.index({ browserProofHash: 1 }, { unique: true });
telegramLinkSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
