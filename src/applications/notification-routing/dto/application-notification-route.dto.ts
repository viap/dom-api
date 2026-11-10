import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { Role } from '@/roles/enums/roles.enum';

export type ApplicationNotificationRouteIssue =
  | 'role_ineligible'
  | 'telegram_identity_unlinked';

export interface ApplicationNotificationRouteUserDto {
  id: string;
  name: string;
  roles: Array<Role>;
  telegramIdentityLinked: boolean;
  eligible: boolean;
  issue?: ApplicationNotificationRouteIssue;
}

export interface ApplicationNotificationRouteDto {
  formType: ApplicationFormType;
  revision: number;
  responsibleUsers: Array<ApplicationNotificationRouteUserDto>;
  missingUserIds: Array<string>;
  fallbackActive: boolean;
  fallbackAvailable: boolean;
}

export interface ApplicationNotificationEligibleUserDto {
  id: string;
  name: string;
  roles: Array<Role>;
  telegramIdentityLinked: boolean;
  assignable: boolean;
}

export interface UpdateApplicationNotificationRouteDto {
  expectedRevision: number;
  responsibleUserIds: Array<string>;
}
