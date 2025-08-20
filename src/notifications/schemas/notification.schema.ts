import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { Role } from 'src/roles/enums/roles.enum';
import { UserDocument } from 'src/users/schemas/user.schema';
import { NotificationStatuses } from '../enums/notification-statuses.enum';
import { NotificationTypes } from '../enums/notification-types.enum';

export type NotificationDocument = Notification & Document;

@Schema()
export class Notification {
  @Prop({ required: true, default: () => Date.now() })
  timesatamp: number;

  @Prop({ required: true, default: () => Date.now() })
  startsAt: number;

  @Prop({ required: false })
  finishAt: number;

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
