import { Price } from '@/common/schemas/price.schema';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';

export interface CreateEventDto {
  domainId: string;
  type: EventType;
  status?: EventStatus;
  title: string;
  slug: string;
  startAt: string;
  endAt: string;
  locationId?: string;
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
}
