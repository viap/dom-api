import * as Joi from 'joi';

const keySchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9-]+$/)
  .min(1)
  .max(120)
  .required();

const slugSchema = keySchema;

export const menuKeyParamsSchema = Joi.object({
  key: keySchema,
});

export const menuDomainKeyParamsSchema = Joi.object({
  domainSlug: slugSchema,
  key: keySchema,
});
