import * as Joi from 'joi';

const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const createScheduleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Schedule name is required',
    'string.min': 'Schedule name must be at least 1 character',
    'string.max': 'Schedule name cannot exceed 100 characters',
  }),

  description: Joi.string().trim().max(500).allow('').optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),

  type: Joi.string().valid('working_hours', 'unavailable').required().messages({
    'any.only': 'Type must be either "working_hours" or "unavailable"',
    'any.required': 'Type is required',
  }),

  room: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid room ID format',
    }),

  company: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid company ID format',
    }),

  startDate: Joi.date().iso().required().messages({
    'date.base': 'Start date must be a valid date',
    'date.format': 'Start date must be in ISO format',
    'any.required': 'Start date is required',
  }),

  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().messages({
    'date.base': 'End date must be a valid date',
    'date.format': 'End date must be in ISO format',
    'date.min': 'End date must be after start date',
  }),

  startTime: Joi.string().pattern(timePattern).required().messages({
    'string.pattern.base': 'Start time must be in HH:MM format (24-hour)',
    'any.required': 'Start time is required',
  }),

  endTime: Joi.string().pattern(timePattern).required().messages({
    'string.pattern.base': 'End time must be in HH:MM format (24-hour)',
    'any.required': 'End time is required',
  }),

  recurrencePattern: Joi.string()
    .valid('none', 'daily', 'weekly', 'monthly')
    .default('none')
    .messages({
      'any.only':
        'Recurrence pattern must be one of: none, daily, weekly, monthly',
    }),

  daysOfWeek: Joi.array()
    .items(Joi.number().integer().min(0).max(6))
    .max(7)
    .optional()
    .messages({
      'array.max': 'Cannot specify more than 7 days',
      'number.min': 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
      'number.max': 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
    }),

  recurrenceEndDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.base': 'Recurrence end date must be a valid date',
      'date.format': 'Recurrence end date must be in ISO format',
      'date.min': 'Recurrence end date must be after start date',
    }),

  isActive: Joi.boolean().default(true).optional(),

  timeZone: Joi.string().trim().max(50).default('UTC').optional().messages({
    'string.max': 'Time zone cannot exceed 50 characters',
  }),

  metadata: Joi.object({
    reason: Joi.string().trim().max(200).optional().messages({
      'string.max': 'Reason cannot exceed 200 characters',
    }),

    contactPerson: Joi.string().trim().max(100).optional().messages({
      'string.max': 'Contact person cannot exceed 100 characters',
    }),

    priority: Joi.number().integer().min(1).max(5).optional().messages({
      'number.min': 'Priority must be between 1 and 5',
      'number.max': 'Priority must be between 1 and 5',
    }),

    color: Joi.string()
      .trim()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .messages({
        'string.pattern.base':
          'Color must be a valid hex color code (e.g., #FF0000)',
      }),
  }).optional(),
})
  .custom((value, helpers) => {
    // Validate that either room or company is provided
    if (!value.room && !value.company) {
      return helpers.error('custom.roomOrCompany');
    }

    // Validate time range
    if (value.startTime >= value.endTime) {
      return helpers.error('custom.timeRange');
    }

    // Validate recurrence settings
    if (
      value.recurrencePattern === 'weekly' &&
      (!value.daysOfWeek || value.daysOfWeek.length === 0)
    ) {
      return helpers.error('custom.weeklyRecurrence');
    }

    return value;
  }, 'Custom validations')
  .messages({
    'custom.roomOrCompany': 'Either room or company must be specified',
    'custom.timeRange': 'Start time must be before end time',
    'custom.weeklyRecurrence':
      'Days of week must be specified for weekly recurrence',
  });
