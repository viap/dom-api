import * as Joi from 'joi';
import { DomainCode } from '../enums/domain-code.enum';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';

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

  slug: joiSlugSchema.optional(),

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
