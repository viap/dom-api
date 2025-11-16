import * as Joi from 'joi';

export const createCompanySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Company name is required',
    'string.min': 'Company name must be at least 1 character',
    'string.max': 'Company name cannot exceed 100 characters',
  }),

  description: Joi.string().trim().max(500).allow('').optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),

  address: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'Address is required',
    'string.min': 'Address must be at least 1 character',
    'string.max': 'Address cannot exceed 200 characters',
  }),

  phone: Joi.string()
    .trim()
    .pattern(/^[\+]?[0-9\s\-\(\)]+$/)
    .max(20)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format',
      'string.max': 'Phone number cannot exceed 20 characters',
    }),

  email: Joi.string().trim().email().max(100).optional().messages({
    'string.email': 'Invalid email format',
    'string.max': 'Email cannot exceed 100 characters',
  }),

  website: Joi.string().trim().uri().max(200).optional().messages({
    'string.uri': 'Invalid website URL format',
    'string.max': 'Website URL cannot exceed 200 characters',
  }),

  isActive: Joi.boolean().default(true).optional(),

  settings: Joi.object({
    defaultBookingDuration: Joi.number()
      .integer()
      .min(15)
      .max(480)
      .optional()
      .messages({
        'number.min': 'Default booking duration must be at least 15 minutes',
        'number.max':
          'Default booking duration cannot exceed 480 minutes (8 hours)',
      }),

    advanceBookingDays: Joi.number()
      .integer()
      .min(0)
      .max(365)
      .optional()
      .messages({
        'number.min': 'Advance booking days cannot be negative',
        'number.max': 'Advance booking days cannot exceed 365 days',
      }),

    cancellationPolicy: Joi.string().trim().max(1000).optional().messages({
      'string.max': 'Cancellation policy cannot exceed 1000 characters',
    }),

    timeZone: Joi.string().trim().max(50).optional().messages({
      'string.max': 'Time zone cannot exceed 50 characters',
    }),
  }).optional(),
});
