import * as Joi from 'joi';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';

export const partnerSlugParamsSchema = Joi.object({
  slug: joiSlugSchema.required(),
});
