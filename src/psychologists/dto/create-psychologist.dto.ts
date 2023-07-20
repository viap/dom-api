import * as Joi from 'joi';

export class CreatePsychologistDto {
  readonly user: string;
}

export const createPsychologistSchema = Joi.object<CreatePsychologistDto>({
  user: Joi.string().required(),
});
