import * as Joi from 'joi';

export const mediaQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  isPublished: Joi.boolean().optional(),
});
