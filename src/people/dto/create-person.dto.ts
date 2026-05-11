import { Contact } from '@/common/schemas/contact.schema';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { Price } from '@/common/schemas/price.schema';
import { PersonRole } from '../enums/person-role.enum';
import { WorkFormat } from '../enums/work-format.enum';

export interface CreatePersonDto {
  userId?: string;
  slug: string;
  fullName: string;
  roles?: PersonRole[];
  bio?: string;
  education?: string;
  experience?: string;
  services?: Array<{
    title: string;
    prices: Array<Price>;
  }>;
  workFormat?: WorkFormat[];
  photoId?: string;
  contacts?: Array<Contact>;
  socialLinks?: Array<{
    platform: SocialNetworks;
    url?: string;
    value?: string;
  }>;
  isPublished?: boolean;
}
