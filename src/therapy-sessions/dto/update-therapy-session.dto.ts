import { Price } from '@/common/schemas/price.schema';
import { SessionDuration } from '@/psychologists/schemas/session-duration.schema';

export class UpdateTherapySessionDto {
  dateTime?: number;
  duration?: SessionDuration;
  price?: Price;
  commission?: Price;
  descr?: string;
}
