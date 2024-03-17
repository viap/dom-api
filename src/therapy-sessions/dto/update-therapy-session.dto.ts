import { Price } from 'src/common/schemas/price.schema';
import { SessionDuration } from 'src/psychologists/schemas/session-duration.schema';

export class UpdateTherapySessionDto {
  dateTime?: number;
  duration?: SessionDuration;
  price?: Price;
  comission?: Price;
  descr?: string;
}
