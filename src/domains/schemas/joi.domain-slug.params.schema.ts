import * as Joi from 'joi';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';

export const domainSlugParamsSchema = Joi.object({
  slug: joiSlugSchema.required(),
});
