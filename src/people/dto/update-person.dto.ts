import { Contact } from '@/common/schemas/contact.schema';
import { SocialNetworks } from '@/common/enums/social-networks.enum';

export interface UpdatePersonDto {
  userId?: string;
  fullName?: string;
  roles?: string[];
  bio?: string;
  photoId?: string;
  contacts?: Array<Contact>;
  socialLinks?: Array<{
    platform: SocialNetworks;
    url: string;
  }>;
  isPublished?: boolean;
}
