import * as Joi from 'joi';
import { PartnerType } from '../enums/partner-type.enum';

export const updatePartnerSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).optional().messages({
    'string.empty': 'Title cannot be empty',
    'string.max': 'Title cannot exceed 150 characters',
  }),

  type: Joi.string()
    .valid(...Object.values(PartnerType))
    .optional()
    .messages({
      'any.only': 'Invalid partner type',
    }),

  description: Joi.string().trim().max(2000).allow('').optional().messages({
    'string.max': 'Description cannot exceed 2000 characters',
  }),

  logoId: Joi.string().hex().length(24).optional(),

  website: Joi.string().trim().uri().max(300).optional().messages({
    'string.uri': 'Invalid website URL format',
    'string.max': 'Website cannot exceed 300 characters',
  }),

  contactPerson: Joi.object({
    name: Joi.string().trim().max(120).optional(),
    email: Joi.string().trim().email().max(120).optional(),
    phone: Joi.string()
      .trim()
      .pattern(/^[\+]?[0-9\s\-\(\)]+$/)
      .max(30)
      .optional(),
  }).optional(),

  isPublished: Joi.boolean().optional(),
}).min(1);
