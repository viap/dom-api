import * as Joi from 'joi';
import { Role } from 'src/roles/enums/roles.enum';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationStatuses } from '../enums/notification-statuses.enum';
import { NotificationTypes } from '../enums/notification-types.enum';

export const joiCreateNotificationSchema = Joi.object<CreateNotificationDto>({
  type: Joi.string()
    .valid(...Object.values(NotificationTypes))
    .required(),
  status: Joi.string().valid(...Object.values(NotificationStatuses)),
  title: Joi.string(),
  message: Joi.string(),
  roles: Joi.array<Role>().items(...Object.values(Role)),
  recipients: Joi.array<string>(),
  startsAt: Joi.number(),
  finishAt: Joi.number(),
});
