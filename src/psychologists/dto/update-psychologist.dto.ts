import { Currency } from '../enums/currency.enum';
import { Education } from '../schemas/education.schema';
import { SessionDuration } from '../schemas/session-duration.schema';

export class UpdatePsychologistDto {
  readonly currency?: Currency;
  readonly sessionDurations?: Array<SessionDuration>;
  readonly education?: Array<Education>;
  readonly isInTheClub?: boolean;
}
