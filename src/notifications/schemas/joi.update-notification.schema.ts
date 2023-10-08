import * as Joi from 'joi';
import { Role } from 'src/roles/enums/roles.enum';
import { UpdateNotificationDto } from '../dto/update-notification.dto';
import { NotificationStatuses } from '../enums/notification-statuses.enum';

export const joiUpdateNotificationSchema = Joi.object<UpdateNotificationDto>({
  status: Joi.array<NotificationStatuses>().items(
    ...Object.values(NotificationStatuses),
  ),
  roles: Joi.array<Role>().items(...Object.values(Role)),
  recipients: Joi.array<string>(),
  received: Joi.array<string>(),
  startsAt: Joi.number(),
  finishAt: Joi.number(),
});
