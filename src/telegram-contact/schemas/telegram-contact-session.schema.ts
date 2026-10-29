import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

export type TelegramContactSessionDocument = TelegramContactSession & Document;

@Schema({ timestamps: true })
export class TelegramContactSession {
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TelegramIdentity',
  })
  identityId: mongoose.Types.ObjectId;

  @Prop({ required: true, select: false })
  tokenHash: string;

  @Prop({ required: true })
  lastUsedAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  revokedAt?: Date;
}

export const telegramContactSessionSchema = SchemaFactory.createForClass(
  TelegramContactSession,
);

telegramContactSessionSchema.index({ tokenHash: 1 }, { unique: true });
telegramContactSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
telegramContactSessionSchema.index({ identityId: 1, revokedAt: 1 });
