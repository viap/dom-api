import { Role } from 'src/roles/enums/roles.enum';
import { NotificationTypes } from '../enums/notification-types.enum';
import { NotificationStatuses } from '../enums/notification-statuses.enum';

export class CreateNotificationDto {
  type: NotificationTypes;
  status?: NotificationStatuses;
  roles?: Array<Role>;
  recipients?: Array<string>;
  startsAt?: number;
  finishAt?: number;
}
