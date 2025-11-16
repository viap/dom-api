import { Contact } from 'src/common/schemas/contact.schema';
import { Role } from 'src/roles/enums/roles.enum';

export class UpdateUserDto {
  readonly name?: string;
  readonly login?: string;
  readonly password?: string;
  readonly roles?: Array<Role>;
  readonly descr?: string;
  readonly contacts?: Array<Contact>;
}
