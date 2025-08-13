import * as Joi from 'joi';

export const createRoomSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Room name is required',
    'string.min': 'Room name must be at least 1 character',
    'string.max': 'Room name cannot exceed 100 characters',
  }),

  description: Joi.string().trim().max(500).allow('').optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),

  company: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid company ID format',
      'any.required': 'Company ID is required',
    }),

  capacity: Joi.number().integer().min(1).max(1000).required().messages({
    'number.base': 'Capacity must be a number',
    'number.integer': 'Capacity must be a whole number',
    'number.min': 'Capacity must be at least 1',
    'number.max': 'Capacity cannot exceed 1000',
    'any.required': 'Capacity is required',
  }),

  amenities: Joi.array()
    .items(Joi.string().trim().max(50))
    .max(20)
    .optional()
    .messages({
      'array.max': 'Cannot have more than 20 amenities',
      'string.max': 'Each amenity cannot exceed 50 characters',
    }),

  location: Joi.string().trim().max(200).optional().messages({
    'string.max': 'Location cannot exceed 200 characters',
  }),

  isActive: Joi.boolean().default(true).optional(),

  settings: Joi.object({
    allowMultipleBookings: Joi.boolean().optional(),

    minimumBookingDuration: Joi.number()
      .integer()
      .min(15)
      .max(480)
      .optional()
      .messages({
        'number.min': 'Minimum booking duration must be at least 15 minutes',
        'number.max':
          'Minimum booking duration cannot exceed 480 minutes (8 hours)',
      }),

    maximumBookingDuration: Joi.number()
      .integer()
      .min(30)
      .max(1440)
      .optional()
      .messages({
        'number.min': 'Maximum booking duration must be at least 30 minutes',
        'number.max':
          'Maximum booking duration cannot exceed 1440 minutes (24 hours)',
      }),

    cleaningTimeAfterBooking: Joi.number()
      .integer()
      .min(0)
      .max(120)
      .optional()
      .messages({
        'number.min': 'Cleaning time cannot be negative',
        'number.max': 'Cleaning time cannot exceed 120 minutes',
      }),

    advanceNoticeRequired: Joi.number()
      .integer()
      .min(0)
      .max(168)
      .optional()
      .messages({
        'number.min': 'Advance notice cannot be negative',
        'number.max': 'Advance notice cannot exceed 168 hours (1 week)',
      }),
  }).optional(),

  equipment: Joi.object({
    projector: Joi.boolean().optional(),
    whiteboard: Joi.boolean().optional(),
    audioSystem: Joi.boolean().optional(),
    videoConferencing: Joi.boolean().optional(),
    wifi: Joi.boolean().optional(),
    airConditioning: Joi.boolean().optional(),
    other: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Cannot have more than 10 other equipment items',
        'string.max': 'Each equipment item cannot exceed 50 characters',
      }),
  }).optional(),
});
