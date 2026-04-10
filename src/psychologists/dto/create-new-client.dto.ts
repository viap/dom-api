import { Contact } from '@/common/schemas/contact.schema';

export class CreateNewClientDto {
  readonly name: string;
  readonly descr?: string;
  readonly therapyRequest?: string;
  readonly contacts?: Array<Contact>;
}
