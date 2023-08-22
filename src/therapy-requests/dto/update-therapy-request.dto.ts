import { Contact } from 'src/common/schemas/contact.schema';

export class UpdateTherapyRequestDto {
  readonly name?: string;
  readonly descr?: string;
  readonly user?: string;
  readonly psychologist?: string;
  readonly contacts?: Array<Contact>;
}
