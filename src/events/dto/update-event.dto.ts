import { Price } from '@/common/schemas/price.schema';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';

export interface UpdateEventDto {
  domainId?: string;
  type?: EventType;
  status?: EventStatus;
  title?: string;
  slug?: string;
  startAt?: number;
  endAt?: number;
  locationId?: string;
  speakerIds?: string[];
  organizerIds?: string[];
  partnerIds?: string[];
  registration?: {
    isOpen?: boolean;
    maxParticipants?: number;
    deadline?: number;
  };
  priceGroups?: Array<{
    title?: string;
    deadline?: string;
    price: Price;
  }>;
  capacity?: number;
}
