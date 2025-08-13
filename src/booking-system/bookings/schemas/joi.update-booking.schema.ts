import * as Joi from 'joi';

export const updateBookingSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).optional().messages({
    'string.empty': 'Booking title cannot be empty',
    'string.min': 'Booking title must be at least 1 character',
    'string.max': 'Booking title cannot exceed 200 characters',
  }),

  description: Joi.string().trim().max(1000).allow('').optional().messages({
    'string.max': 'Description cannot exceed 1000 characters',
  }),

  room: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid room ID format',
    }),

  startDateTime: Joi.date().iso().optional().messages({
    'date.base': 'Start date time must be a valid date',
    'date.format': 'Start date time must be in ISO format',
  }),

  endDateTime: Joi.date().iso().optional().messages({
    'date.base': 'End date time must be a valid date',
    'date.format': 'End date time must be in ISO format',
  }),

  status: Joi.string()
    .valid('pending', 'confirmed', 'canceled')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, confirmed, canceled',
    }),

  cancellationReason: Joi.string()
    .trim()
    .max(500)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Cancellation reason cannot exceed 500 characters',
    }),

  recurrenceType: Joi.string()
    .valid('none', 'daily', 'weekly', 'monthly', 'yearly')
    .optional()
    .messages({
      'any.only':
        'Recurrence type must be one of: none, daily, weekly, monthly, yearly',
    }),

  recurrenceEndDate: Joi.date().iso().optional().messages({
    'date.base': 'Recurrence end date must be a valid date',
    'date.format': 'Recurrence end date must be in ISO format',
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

  recurrenceInterval: Joi.number()
    .integer()
    .min(1)
    .max(52)
    .optional()
    .messages({
      'number.min': 'Recurrence interval must be at least 1',
      'number.max': 'Recurrence interval cannot exceed 52',
    }),

  attendees: Joi.array()
    .items(Joi.string().trim().email())
    .max(100)
    .optional()
    .messages({
      'array.max': 'Cannot have more than 100 attendees',
      'string.email': 'Each attendee must be a valid email address',
    }),

  timeZone: Joi.string().trim().max(50).optional().messages({
    'string.max': 'Time zone cannot exceed 50 characters',
  }),

  metadata: Joi.object({
    purpose: Joi.string().trim().max(200).allow('').optional().messages({
      'string.max': 'Purpose cannot exceed 200 characters',
    }),

    department: Joi.string().trim().max(100).allow('').optional().messages({
      'string.max': 'Department cannot exceed 100 characters',
    }),

    contactEmail: Joi.string()
      .trim()
      .email()
      .max(100)
      .allow('')
      .optional()
      .messages({
        'string.email': 'Contact email must be a valid email address',
        'string.max': 'Contact email cannot exceed 100 characters',
      }),

    contactPhone: Joi.string()
      .trim()
      .pattern(/^[\+]?[0-9\s\-\(\)]+$/)
      .max(20)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base': 'Invalid contact phone format',
        'string.max': 'Contact phone cannot exceed 20 characters',
      }),

    specialRequirements: Joi.string()
      .trim()
      .max(500)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Special requirements cannot exceed 500 characters',
      }),

    estimatedAttendees: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .allow(null)
      .optional()
      .messages({
        'number.min': 'Estimated attendees must be at least 1',
        'number.max': 'Estimated attendees cannot exceed 1000',
      }),

    isPrivate: Joi.boolean().optional(),

    color: Joi.string()
      .trim()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base':
          'Color must be a valid hex color code (e.g., #FF0000)',
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
  }).optional(),

  equipmentRequests: Joi.object({
    projector: Joi.boolean().optional(),
    microphone: Joi.boolean().optional(),
    videoConferencing: Joi.boolean().optional(),
    catering: Joi.boolean().optional(),
    whiteboard: Joi.boolean().optional(),
    flipChart: Joi.boolean().optional(),
    other: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Cannot have more than 10 other equipment requests',
        'string.max': 'Each equipment request cannot exceed 50 characters',
      }),
  }).optional(),
})
  .min(1)
  .custom((value, helpers) => {
    // Validate end date time if both start and end are provided
    if (value.startDateTime && value.endDateTime) {
      if (new Date(value.endDateTime) <= new Date(value.startDateTime)) {
        return helpers.error('custom.dateTimeRange');
      }

      // Validate booking duration
      const startTime = new Date(value.startDateTime);
      const endTime = new Date(value.endDateTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = durationMs / (1000 * 60);

      if (durationMinutes < 15) {
        return helpers.error('custom.minimumDuration');
      }

      if (durationMinutes > 1440) {
        // 24 hours
        return helpers.error('custom.maximumDuration');
      }
    }

    // Validate recurrence settings
    if (
      value.recurrenceType === 'weekly' &&
      value.daysOfWeek &&
      value.daysOfWeek.length === 0
    ) {
      return helpers.error('custom.weeklyRecurrence');
    }

    return value;
  }, 'Custom validations')
  .messages({
    'object.min': 'At least one field must be provided for update',
    'custom.dateTimeRange': 'End date time must be after start date time',
    'custom.minimumDuration': 'Booking duration must be at least 15 minutes',
    'custom.maximumDuration': 'Booking duration cannot exceed 24 hours',
    'custom.weeklyRecurrence':
      'Days of week must be specified for weekly recurrence',
  });
