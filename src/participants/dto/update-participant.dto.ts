import * as Joi from 'joi';

export class UpdateParticipantDto {
  readonly name: string;
  readonly user: string;
  readonly descr: string;
  readonly contacts: object;
}

export const updateParticipantSchema = Joi.object<UpdateParticipantDto>({
  name: Joi.string().required(),
  user: Joi.string(),
  descr: Joi.string(),
  contacts: Joi.object().pattern(Joi.string(), Joi.string()),
});
