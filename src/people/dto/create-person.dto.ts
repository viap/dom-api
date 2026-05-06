import { Contact } from '@/common/schemas/contact.schema';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { PersonRole } from '../enums/person-role.enum';

export interface CreatePersonDto {
  userId?: string;
  slug: string;
  fullName: string;
  roles?: PersonRole[];
  bio?: string;
  photoId?: string;
  contacts?: Array<Contact>;
  socialLinks?: Array<{
    platform: SocialNetworks;
    url?: string;
    value?: string;
  }>;
  isPublished?: boolean;
}
