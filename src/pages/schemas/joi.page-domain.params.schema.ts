import * as Joi from 'joi';

const slugSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9-]+$/)
  .min(1)
  .max(120)
  .required();

export const pageDomainParamsSchema = Joi.object({
  domainSlug: slugSchema,
});

export const pageDomainPageParamsSchema = Joi.object({
  domainSlug: slugSchema,
  pageSlug: slugSchema,
});

export const pageGlobalPageParamsSchema = Joi.object({
  pageSlug: slugSchema,
});
