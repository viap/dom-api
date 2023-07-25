import { Contact } from '../schemas/contact.schema';

export class UpdateUserDto {
  readonly name?: string;
  readonly roles?: Array<string>;
  readonly telegramId?: string;
  readonly descr?: string;
  readonly contacts?: Array<Contact>;
}
