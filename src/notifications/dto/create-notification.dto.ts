import { Role } from '@/roles/enums/roles.enum';
import { NotificationStatuses } from '../enums/notification-statuses.enum';
import { NotificationTypes } from '../enums/notification-types.enum';
import { NotificationMessageEntity } from '../types/notification-message-entity';

export class CreateNotificationDto {
  type: NotificationTypes;
  status?: NotificationStatuses;
  title?: string;
  message?: string;
  messageEntities?: Array<NotificationMessageEntity>;
  roles?: Array<Role>;
  recipients?: Array<string>;
  startsAt?: string;
  finishAt?: string;
}
