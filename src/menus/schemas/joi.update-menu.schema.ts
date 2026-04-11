import * as Joi from 'joi';
import { createMenuSchema } from './joi.create-menu.schema';

export const updateMenuSchema = createMenuSchema
  .fork(['key', 'title'], (schema) => schema.optional())
  .keys({
    domainId: Joi.alternatives()
      .try(Joi.string().hex().length(24), Joi.valid(null))
      .optional(),
  });
