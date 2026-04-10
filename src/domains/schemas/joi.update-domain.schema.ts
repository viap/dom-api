import * as Joi from 'joi';
import { DomainCode } from '../enums/domain-code.enum';

export const updateDomainSchema = Joi.object({
  code: Joi.string()
    .valid(...Object.values(DomainCode))
    .optional()
    .messages({
      'any.only': 'Invalid domain code',
    }),

  title: Joi.string().trim().min(1).max(150).optional().messages({
    'string.empty': 'Title cannot be empty',
    'string.min': 'Title must be at least 1 character',
    'string.max': 'Title cannot exceed 150 characters',
  }),

  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.pattern.base':
        'Slug must contain only lowercase letters, numbers, and hyphens',
      'string.max': 'Slug cannot exceed 100 characters',
    }),

  isActive: Joi.boolean().optional(),

  order: Joi.number().integer().min(0).optional().messages({
    'number.base': 'Order must be a number',
    'number.integer': 'Order must be an integer',
    'number.min': 'Order cannot be negative',
  }),

  seo: Joi.object()
    .pattern(Joi.string().max(100), Joi.string().max(300))
    .optional(),
}).min(1);
