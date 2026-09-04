import { Price } from '@/common/schemas/price.schema';
import { PageBlock } from '@/pages/types/page-block.interface';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';
import { EventSchedule } from '../types/event-schedule.interface';

export interface UpdateEventDto {
  domainId?: string;
  type?: EventType;
  status?: EventStatus;
  title?: string;
  description?: string;
  slug?: string;
  startAt?: string;
  endAt?: string;
  schedule?: EventSchedule;
  locationId?: string;
  mediaId?: string;
  speakerIds?: string[];
  organizerIds?: string[];
  partnerIds?: string[];
  registration?: {
    isOpen?: boolean;
    maxParticipants?: number;
    deadline?: string;
  };
  priceGroups?: Array<{
    title?: string;
    deadline?: string;
    price: Price;
  }>;
  capacity?: number;
  seo?: Record<string, string>;
  blocks?: PageBlock[];
}
