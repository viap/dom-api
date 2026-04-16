import { Contact } from '@/common/schemas/contact.schema';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { PersonRole } from '../enums/person-role.enum';

export interface UpdatePersonDto {
  userId?: string;
  fullName?: string;
  roles?: PersonRole[];
  bio?: string;
  photoId?: string;
  contacts?: Array<Contact>;
  socialLinks?: Array<{
    platform: SocialNetworks;
    url: string;
  }>;
  isPublished?: boolean;
}
