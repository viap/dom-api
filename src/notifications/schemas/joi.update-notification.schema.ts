import * as Joi from 'joi';
import { Role } from '@/roles/enums/roles.enum';
import { UpdateNotificationDto } from '../dto/update-notification.dto';
import { NotificationStatuses } from '../enums/notification-statuses.enum';
import { joiNotificationMessageEntitiesSchema } from './joi.notification-message-entity.schema';

export const joiUpdateNotificationSchema = Joi.object<UpdateNotificationDto>({
  status: Joi.array<NotificationStatuses>().items(
    ...Object.values(NotificationStatuses),
  ),
  roles: Joi.array<Role>().items(...Object.values(Role)),
  title: Joi.string(),
  message: Joi.string(),
  messageEntities: joiNotificationMessageEntitiesSchema,
  recipients: Joi.array<string>(),
  received: Joi.array<string>(),
  startsAt: Joi.date().iso(),
  finishAt: Joi.date().iso(),
}).with('messageEntities', 'message');
