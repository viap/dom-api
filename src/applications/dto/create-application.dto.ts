import { Contact } from '@/common/schemas/contact.schema';
import { ApplicationFormType } from '../enums/application-form-type.enum';

export interface CreateApplicationDto {
  domainId: string;
  formType: ApplicationFormType;
  source?: {
    entityType?: string;
    entityId?: string;
    utm?: Record<string, string>;
  };
  applicant: {
    name: string;
    contacts: Array<Contact>;
  };
  payload?: Record<string, unknown>;
}
