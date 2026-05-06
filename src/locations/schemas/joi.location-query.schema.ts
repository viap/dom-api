import * as Joi from 'joi';

export const locationQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  title: Joi.string().trim().max(150).optional(),
  city: Joi.string().trim().max(100).optional(),
});
