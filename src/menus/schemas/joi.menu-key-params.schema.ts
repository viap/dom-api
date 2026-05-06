import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';

export const menuKeyParamsSchema = Joi.object({
  key: joiSlugSchema.required(),
});

export const menuPageIdParamsSchema = Joi.object({
  pageId: joiObjectId.required(),
});
