import * as Joi from 'joi';

const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const updateScheduleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional().messages({
    'string.empty': 'Schedule name cannot be empty',
    'string.min': 'Schedule name must be at least 1 character',
    'string.max': 'Schedule name cannot exceed 100 characters',
  }),

  description: Joi.string().trim().max(500).allow('').optional().messages({
    'string.max': 'Description cannot exceed 500 characters',
  }),

  type: Joi.string().valid('working_hours', 'unavailable').optional().messages({
    'any.only': 'Type must be either "working_hours" or "unavailable"',
  }),

  room: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid room ID format',
    }),

  company: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid company ID format',
    }),

  startDate: Joi.date().iso().optional().messages({
    'date.base': 'Start date must be a valid date',
    'date.format': 'Start date must be in ISO format',
  }),

  endDate: Joi.date().iso().optional().messages({
    'date.base': 'End date must be a valid date',
    'date.format': 'End date must be in ISO format',
  }),

  startTime: Joi.string().pattern(timePattern).optional().messages({
    'string.pattern.base': 'Start time must be in HH:MM format (24-hour)',
  }),

  endTime: Joi.string().pattern(timePattern).optional().messages({
    'string.pattern.base': 'End time must be in HH:MM format (24-hour)',
  }),

  recurrencePattern: Joi.string()
    .valid('none', 'daily', 'weekly', 'monthly')
    .optional()
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

  recurrenceEndDate: Joi.date().iso().optional().messages({
    'date.base': 'Recurrence end date must be a valid date',
    'date.format': 'Recurrence end date must be in ISO format',
  }),

  isActive: Joi.boolean().optional(),

  timeZone: Joi.string().trim().max(50).optional().messages({
    'string.max': 'Time zone cannot exceed 50 characters',
  }),

  metadata: Joi.object({
    reason: Joi.string().trim().max(200).allow('').optional().messages({
      'string.max': 'Reason cannot exceed 200 characters',
    }),

    contactPerson: Joi.string().trim().max(100).allow('').optional().messages({
      'string.max': 'Contact person cannot exceed 100 characters',
    }),

    priority: Joi.number()
      .integer()
      .min(1)
      .max(5)
      .allow(null)
      .optional()
      .messages({
        'number.min': 'Priority must be between 1 and 5',
        'number.max': 'Priority must be between 1 and 5',
      }),

    color: Joi.string()
      .trim()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base':
          'Color must be a valid hex color code (e.g., #FF0000)',
      }),
  }).optional(),
})
  .min(1)
  .custom((value, helpers) => {
    // Validate time range if both are provided
    if (value.startTime && value.endTime && value.startTime >= value.endTime) {
      return helpers.error('custom.timeRange');
    }

    // Validate end date if provided with start date
    if (
      value.startDate &&
      value.endDate &&
      new Date(value.endDate) < new Date(value.startDate)
    ) {
      return helpers.error('custom.dateRange');
    }

    // Validate recurrence end date
    if (
      value.startDate &&
      value.recurrenceEndDate &&
      new Date(value.recurrenceEndDate) < new Date(value.startDate)
    ) {
      return helpers.error('custom.recurrenceDateRange');
    }

    return value;
  }, 'Custom validations')
  .messages({
    'object.min': 'At least one field must be provided for update',
    'custom.timeRange': 'Start time must be before end time',
    'custom.dateRange': 'End date must be after start date',
    'custom.recurrenceDateRange':
      'Recurrence end date must be after start date',
  });
