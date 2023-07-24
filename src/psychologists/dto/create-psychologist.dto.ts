import * as Joi from 'joi';

export class CreatePsychologistDto {
  readonly userId: string;
}

export const createPsychologistSchema = Joi.object<CreatePsychologistDto>({
  userId: Joi.string().required(),
});
