import * as Joi from 'joi';

export class CreateParticipantDto {
  readonly name: string;
  readonly user?: string;
  readonly descr?: string;
  readonly contacts?: object;
}

export const createParticipantSchema = Joi.object<CreateParticipantDto>({
  name: Joi.string().required(),
  user: Joi.string(),
  descr: Joi.string(),
  contacts: Joi.object().pattern(Joi.string(), Joi.string()),
});
