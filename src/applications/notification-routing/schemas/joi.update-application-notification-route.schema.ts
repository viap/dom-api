import { UpdateApplicationNotificationRouteDto } from '@/applications/notification-routing/dto/application-notification-route.dto';
import * as Joi from 'joi';

const objectIdSchema = Joi.string().hex().length(24);

export const updateApplicationNotificationRouteSchema =
  Joi.object<UpdateApplicationNotificationRouteDto>({
    expectedRevision: Joi.number().integer().min(0).required(),
    responsibleUserIds: Joi.array()
      .items(objectIdSchema)
      .max(50)
      .unique()
      .required(),
  });
