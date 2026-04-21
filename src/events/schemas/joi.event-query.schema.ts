import * as Joi from 'joi';

export const eventQuerySchema = Joi.object({
  domainId: Joi.string().hex().length(24),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});
