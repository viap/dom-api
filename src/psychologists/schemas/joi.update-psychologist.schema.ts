import * as Joi from 'joi';
import { UpdatePsychologistDto } from '../dto/update-psychologist.dto';
import { Currencies } from '../enums/currencies.enum';
import { Education } from './education.schema';
import { joiEducationSchema } from './joi.education.schema';
import { joiSessionDurationSchema } from './joi.session-duration.schema';
import { SessionDuration } from './session-duration.schema';

export const joiUpdatePsychologistSchema = Joi.object<UpdatePsychologistDto>({
  currency: Joi.string().valid(...Object.values(Currencies)),
  sessionDurations: Joi.array<SessionDuration>().items(
    joiSessionDurationSchema,
  ),
  education: Joi.array<Education>().items(joiEducationSchema),
  isInTheClub: Joi.boolean(),
});
