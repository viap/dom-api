import { Role } from 'src/roles/enums/roles.enum';

export interface UserContext {
  userId: string;
  roles: Array<Role>;
  clientName?: string;
}
