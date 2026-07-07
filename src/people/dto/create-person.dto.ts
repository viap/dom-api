import { Contact } from '@/common/schemas/contact.schema';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { Price } from '@/common/schemas/price.schema';
import { PersonRole } from '../enums/person-role.enum';
import { WorkFormat } from '../enums/work-format.enum';
import { Languages } from '../enums/languages.enum';
import { PersonAvailability } from '../enums/person-availability.enum';

export interface PersonEducationItemDto {
  startDate?: string;
  endDate?: string;
  institution: string;
  detail?: string;
}

export interface PersonExperienceItemDto {
  startDate?: string;
  endDate?: string;
  title: string;
  organization?: string;
  detail?: string;
}

export interface CreatePersonDto {
  userId?: string;
  slug: string;
  fullName: string;
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
