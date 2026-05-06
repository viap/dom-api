import * as Joi from 'joi';

export const joiSlugSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(1)
  .max(120)
  .messages({
    'string.pattern.base':
      'Slug must contain only lowercase letters, numbers, and single hyphens between words',
    'string.max': 'Slug cannot exceed 120 characters',
  });
