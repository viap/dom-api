import * as Joi from 'joi';
import { CreatePsychologistDto } from '../dto/create-psychologist.dto';

export const joiCreatePsychologistSchema = Joi.object<CreatePsychologistDto>({
  userId: Joi.string().required(),
});
