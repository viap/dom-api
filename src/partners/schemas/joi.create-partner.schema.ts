import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { PartnerType } from '../enums/partner-type.enum';

export const createPartnerSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'Title is required',
    'string.max': 'Title cannot exceed 150 characters',
  }),

  type: Joi.string()
    .valid(...Object.values(PartnerType))
    .required()
    .messages({
      'any.only': 'Invalid partner type',
      'any.required': 'Partner type is required',
    }),

  description: Joi.string().trim().max(2000).allow('').optional().messages({
    'string.max': 'Description cannot exceed 2000 characters',
  }),

  logoId: joiObjectId.optional(),

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

  isPublished: Joi.boolean().default(false).optional(),
});
