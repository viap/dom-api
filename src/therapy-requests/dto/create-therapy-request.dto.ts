import { Contact } from 'src/common/schemas/contact.schema';

export class CreateTherapyRequestDto {
  readonly name: string;
  readonly contacts: Array<Contact>;
  readonly descr?: string;
  readonly psychologist?: string;
  readonly user?: string;
}
