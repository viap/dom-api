import * as Joi from 'joi';

export const joiClientSchema = Joi.object({
  client: Joi.string().min(1).required(),
  descr: Joi.string(),
});
