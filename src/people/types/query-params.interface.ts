import { PersonRole } from '../enums/person-role.enum';

export interface PersonQueryParams {
  limit?: string;
  offset?: string;
  fullName?: string;
  role?: PersonRole;
  [key: string]: string | string[] | undefined;
}
