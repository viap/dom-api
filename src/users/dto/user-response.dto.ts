import { Contact } from '@/common/schemas/contact.schema';
import { Role } from '@/roles/enums/roles.enum';

export class UserResponseDto {
  _id: string;
  name: string;
  login?: string;
  roles: Array<Role>;
  descr?: string;
  contacts: Array<Contact>;
  timeZone?: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
