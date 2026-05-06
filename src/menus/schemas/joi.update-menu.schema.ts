import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';
import { menuItemSchema } from './joi.create-menu.schema';

export const updateMenuSchema = Joi.object({
  key: Joi.alternatives().try(joiSlugSchema, Joi.valid(null)).optional(),
  title: Joi.string().trim().min(1).max(150).optional(),
  pageId: Joi.alternatives().try(joiObjectId, Joi.valid(null)).optional(),
  isActive: Joi.boolean().optional(),
  items: menuItemSchema.optional(),
})
  .or('key', 'pageId', 'title', 'isActive', 'items')
  .min(1);
