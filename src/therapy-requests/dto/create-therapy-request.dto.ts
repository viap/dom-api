import { Contact } from '@/common/schemas/contact.schema';
import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from '../enums/therapy-request-analytics.enum';

export class CreateTherapyRequestDto {
  readonly name: string;
  readonly descr: string;
  readonly user?: string;
  readonly psychologist?: string;
  readonly contacts: Array<Contact>;
  readonly clientGender?: TherapyRequestClientGender;
  readonly requestCategory?: TherapyRequestCategory;
}
