import { Role } from 'src/roles/enums/roles.enum';
import { UserDocument } from 'src/users/schemas/user.schema';

export interface UserContext {
  userId: string;
  roles: Array<Role>;
  clientName?: string;
}

export interface EnhancedRequest {
  user?: UserDocument;
  userContext?: UserContext;
  headers: any;
  params?: Record<string, string>;
}
