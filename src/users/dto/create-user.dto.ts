import { Contact } from 'src/common/schemas/contact.schema';

export class CreateUserDto {
  readonly name: string;
  readonly login?: string;
  readonly password?: string;
  readonly roles?: Array<string>;
  readonly descr?: string;
  readonly contacts?: Array<Contact>;
}
