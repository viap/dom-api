import { Contact } from '@/common/schemas/contact.schema';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { Price } from '@/common/schemas/price.schema';
import { PersonRole } from '../enums/person-role.enum';
import { WorkFormat } from '../enums/work-format.enum';
import { Languages } from '../enums/languages.enum';
import {
  PersonEducationItemDto,
  PersonExperienceItemDto,
} from './create-person.dto';
import { PersonAvailability } from '../enums/person-availability.enum';

export interface UpdatePersonDto {
  userId?: string;
  slug?: string;
  fullName?: string;
  title?: string | null;
  roles?: PersonRole[];
  bio?: string;
  education?: string;
  experience?: string;
  services?: Array<{
    title: string;
    description?: string;
    prices: Array<Price>;
  }>;
  workLocationId?: string | null;
  specializations?: string[];
  educationItems?: PersonEducationItemDto[];
  experienceItems?: PersonExperienceItemDto[];
  availability?: PersonAvailability;
  workFormat?: WorkFormat[];
  languages?: Languages[];
  photoId?: string;
  contacts?: Array<Contact>;
  socialLinks?: Array<{
    platform: SocialNetworks;
    url?: string;
    value?: string;
  }>;
  isPublished?: boolean;
}
