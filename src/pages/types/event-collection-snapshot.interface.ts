import { PublicEventDto } from '@/events/types/public-event.interface';
import { PersistedCollectionIdentity } from './page-block.interface';

export interface EventCollectionSnapshot {
  evaluatedAt: string;
  nextTransitionAt?: string;
  collections: Array<{
    identity: PersistedCollectionIdentity;
    items: string[];
  }>;
  events: PublicEventDto[];
}
