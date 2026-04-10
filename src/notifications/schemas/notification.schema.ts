import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Role } from '@/roles/enums/roles.enum';
import { UserDocument } from '@/users/schemas/user.schema';
import { NotificationStatuses } from '../enums/notification-statuses.enum';
import { NotificationTypes } from '../enums/notification-types.enum';

export type NotificationDocument = Notification &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, default: () => new Date() })
  startsAt: Date;

  @Prop({ required: false })
  finishAt?: Date;

  @Prop({ required: false, default: '' })
  title: string;

  @Prop({ required: false, default: '' })
  message: string;

  @Prop({ required: true, default: [] })
  roles: Array<Role>;

  @Prop({
    required: true,
    type: Array<{ type: mongoose.Schema.Types.ObjectId; ref: 'User' }>,
    default: [],
  })
  recipients: Array<UserDocument>;

  @Prop({
    required: true,
    type: Array<{ type: mongoose.Schema.Types.ObjectId; ref: 'User' }>,
    default: [],
  })
  received: Array<UserDocument>;

  @Prop({ required: true })
  type: NotificationTypes;

  @Prop({ required: true, default: NotificationStatuses.ACTIVE })
  status: NotificationStatuses;
}

export const schemaNotification = SchemaFactory.createForClass(Notification);

schemaNotification.index({ status: 1, startsAt: 1, finishAt: 1 });
schemaNotification.index({ recipients: 1 });
schemaNotification.index({ received: 1 });
schemaNotification.index({ roles: 1 });
