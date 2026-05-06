import * as Joi from 'joi';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';

export const personSlugParamsSchema = Joi.object({
  slug: joiSlugSchema.required(),
});
