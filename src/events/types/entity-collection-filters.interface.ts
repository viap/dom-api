import type { RandomOrdering } from '@/common/utils/ranked-query';
import { EventType } from '../enums/event-type.enum';

export interface EventCollectionContext {
  now: Date;
  domainId?: string;
  ordering?: RandomOrdering;
}

export interface EventEntityCollectionFilters {
  types?: EventType[];
  lifecycle?: 'active';
  temporal?:
    | { mode: 'upcoming' }
    | { mode: 'past' }
    | { mode: 'custom'; from?: string; to?: string };
  locationIds?: string[];
  peopleIds?: string[];
}
