import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';
import * as Joi from 'joi';

export const pageDomainParamsSchema = Joi.object({
  domainSlug: joiSlugSchema.required(),
});

export const pageDomainPageParamsSchema = Joi.object({
  domainSlug: joiSlugSchema.required(),
  pageSlug: joiSlugSchema.required(),
});

export const pageGlobalPageParamsSchema = Joi.object({
  pageSlug: joiSlugSchema.required(),
});
