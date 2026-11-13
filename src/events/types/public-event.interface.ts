import { DomainEvent } from '../schemas/domain-event.schema';

export type RegistrationAvailability = 'open' | 'waitlist' | 'closed';

export type PublicEventDto = Omit<DomainEvent, 'status' | 'registration'> & {
  _id: unknown;
  status: 'active' | 'cancelled' | 'completed';
  registration?: {
    isOpen?: boolean;
    deadline?: string;
  };
  registrationAvailability: RegistrationAvailability;
  evaluatedAt: string;
  nextTransitionAt?: string;
};
