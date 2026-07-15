import { Role } from '@/roles/enums/roles.enum';
import { NotificationStatuses } from '../enums/notification-statuses.enum';
import { NotificationMessageEntity } from '../types/notification-message-entity';

export class UpdateNotificationDto {
  roles?: Array<Role>;
  recipients?: Array<string>;
  title?: string;
  message?: string;
  messageEntities?: Array<NotificationMessageEntity>;
  received?: Array<string>;
  status?: NotificationStatuses;
  startsAt?: string;
  finishAt?: string;
}
