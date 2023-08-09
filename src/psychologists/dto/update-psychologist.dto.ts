import { Currencies } from '../enums/currencies.enum';
import { Education } from '../schemas/education.schema';
import { SessionDuration } from '../schemas/session-duration.schema';

export class UpdatePsychologistDto {
  readonly currency?: Currencies;
  readonly sessionDurations?: Array<SessionDuration>;
  readonly education?: Array<Education>;
  readonly isInTheClub?: boolean;
}
