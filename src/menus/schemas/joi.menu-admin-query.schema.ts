import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';

export const menuAdminQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  key: joiSlugSchema.optional(),
  pageId: joiObjectId.optional(),
});
