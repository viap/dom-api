import * as Joi from 'joi';

export const joiContactSchema = Joi.object({
  network: Joi.string().required(),
  username: Joi.string().required(),
  id: Joi.string(),
  hidden: Joi.boolean(),
});
