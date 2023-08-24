import { Contact } from 'src/common/schemas/contact.schema';

export class CreateNewClientDto {
  readonly name: string;
  readonly descr?: string;
  readonly therapyRequest?: string;
  readonly contacts?: Array<Contact>;
}
