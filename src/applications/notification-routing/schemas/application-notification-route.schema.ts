import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type ApplicationNotificationRouteDocument =
  HydratedDocument<ApplicationNotificationRoute>;

@Schema({
  timestamps: true,
  collection: 'application_notification_routes',
})
export class ApplicationNotificationRoute {
  @Prop({
    required: true,
    enum: Object.values(ApplicationFormType),
  })
  formType: ApplicationFormType;

  @Prop({
    required: true,
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  responsibleUsers: Array<mongoose.Types.ObjectId>;

  @Prop({ required: true, min: 1, default: 1 })
  revision: number;
}

export const applicationNotificationRouteSchema = SchemaFactory.createForClass(
  ApplicationNotificationRoute,
);

applicationNotificationRouteSchema.index({ formType: 1 }, { unique: true });
