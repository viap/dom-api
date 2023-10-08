import * as Joi from 'joi';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationTypes } from '../enums/notification-types.enum';
import { Role } from 'src/roles/enums/roles.enum';
import { NotificationStatuses } from '../enums/notification-statuses.enum';

export const joiCreateNotificationSchema = Joi.object<CreateNotificationDto>({
  type: Joi.string()
    .valid(...Object.values(NotificationTypes))
    .required(),
  status: Joi.array<NotificationStatuses>().items(
    ...Object.values(NotificationStatuses),
  ),
  roles: Joi.array<Role>().items(...Object.values(Role)),
  recipients: Joi.array<string>(),
  startsAt: Joi.number(),
  finishAt: Joi.number(),
});
