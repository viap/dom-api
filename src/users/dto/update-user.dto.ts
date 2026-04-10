import { Contact } from '@/common/schemas/contact.schema';
import { Role } from '@/roles/enums/roles.enum';

export class UpdateUserDto {
  readonly name?: string;
  readonly login?: string;
  readonly password?: string;
  readonly roles?: Array<Role>;
  readonly descr?: string;
  readonly contacts?: Array<Contact>;
  readonly timeZone?: string;
}
