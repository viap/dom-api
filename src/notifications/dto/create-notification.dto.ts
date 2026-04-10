import { Role } from '@/roles/enums/roles.enum';
import { NotificationStatuses } from '../enums/notification-statuses.enum';
import { NotificationTypes } from '../enums/notification-types.enum';

export class CreateNotificationDto {
  type: NotificationTypes;
  status?: NotificationStatuses;
  title?: string;
  message?: string;
  roles?: Array<Role>;
  recipients?: Array<string>;
  startsAt?: string;
  finishAt?: string;
}
