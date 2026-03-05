import { Contact } from 'src/common/schemas/contact.schema';
import { Role } from 'src/roles/enums/roles.enum';

export class UserResponseDto {
  id: string;
  name: string;
  login?: string;
  roles: Array<Role>;
  descr?: string;
  contacts: Array<Contact>;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
