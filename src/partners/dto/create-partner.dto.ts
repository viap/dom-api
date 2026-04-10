import { PartnerType } from '../enums/partner-type.enum';

export interface CreatePartnerDto {
  title: string;
  type: PartnerType;
  description?: string;
  logoId?: string;
  website?: string;
  contactPerson?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  isPublished?: boolean;
}
