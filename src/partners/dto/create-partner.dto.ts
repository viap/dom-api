import { PartnerType } from '../enums/partner-type.enum';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { Contact } from '@/common/schemas/contact.schema';

export interface CreatePartnerDto {
  title: string;
  type: PartnerType;
  description?: string;
  logoId?: string;
  links?: Array<{
    platform: SocialNetworks;
    url?: string;
    value?: string;
  }>;
  contacts?: Array<Contact>;
  isPublished?: boolean;
}
