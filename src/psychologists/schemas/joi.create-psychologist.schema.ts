import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { CreatePsychologistDto } from '../dto/create-psychologist.dto';

export const joiCreatePsychologistSchema = Joi.object<CreatePsychologistDto>({
  userId: joiObjectId.required(),
});
