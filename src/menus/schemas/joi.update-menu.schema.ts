import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { createMenuSchema } from './joi.create-menu.schema';

export const updateMenuSchema = createMenuSchema
  .fork(['key', 'title'], (schema) => schema.optional())
  .keys({
    domainId: Joi.alternatives()
      .try(joiObjectId, Joi.valid(null))
      .optional(),
  });
