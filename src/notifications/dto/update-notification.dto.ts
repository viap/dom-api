import { Role } from 'src/roles/enums/roles.enum';
import { NotificationStatuses } from '../enums/notification-statuses.enum';

export class UpdateNotificationDto {
  roles?: Array<Role>;
  recipients?: Array<string>;
  received?: Array<string>;
  status?: NotificationStatuses;
  startsAt?: number;
  finishAt?: number;
}
