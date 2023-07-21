import * as Joi from 'joi';
import { Currency } from '../enums/currency.enum';
import { Education, educationSchema } from '../schemas/education.schema';
import {
  SessionDuration,
  sessionDurationSchema,
} from '../schemas/session-duration.schema';

export class UpdatePsychologistDto {
  currency: Currency;
  sessionDurations: Array<SessionDuration>;
  education: Array<Education>;
  isInTheClub: boolean;
  contacts: object;
}

export const updatePsychologistSchema = Joi.object<UpdatePsychologistDto>({
  currency: Joi.string().valid(...Object.values(Currency)),
  sessionDurations: Joi.array<SessionDuration>().items(
    Joi.object().schema(sessionDurationSchema),
  ),
  education: Joi.array<Education>().items(Joi.object().schema(educationSchema)),
  isInTheClub: Joi.boolean(),
  contacts: Joi.object().pattern(Joi.string(), Joi.string()),
});
