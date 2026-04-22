import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';

export const menuAdminQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  key: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .max(120)
    .optional(),
  domainId: joiObjectId.optional(),
  isGlobal: Joi.boolean().optional(),
}).custom((value, helpers) => {
  if (value.domainId && value.isGlobal) {
    return helpers.error('any.custom', {
      message: 'domainId and isGlobal cannot be used together',
    });
  }

  return value;
}, 'menu admin query validation');
