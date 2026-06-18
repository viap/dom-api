import * as Joi from 'joi';

export const joiSeoSchema = Joi.object()
  .pattern(Joi.string().trim().max(100), Joi.string().trim().max(300))
  .max(20);
