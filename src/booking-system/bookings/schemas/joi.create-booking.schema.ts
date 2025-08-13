import * as Joi from 'joi';

export const createBookingSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'Booking title is required',
    'string.min': 'Booking title must be at least 1 character',
    'string.max': 'Booking title cannot exceed 200 characters',
  }),

  description: Joi.string().trim().max(1000).allow('').optional().messages({
    'string.max': 'Description cannot exceed 1000 characters',
  }),

  room: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid room ID format',
      'any.required': 'Room ID is required',
    }),

  bookedBy: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User ID is required',
    }),

  startDateTime: Joi.date().iso().required().messages({
    'date.base': 'Start date time must be a valid date',
    'date.format': 'Start date time must be in ISO format',
    'any.required': 'Start date time is required',
  }),

  endDateTime: Joi.date()
    .iso()
    .min(Joi.ref('startDateTime'))
    .required()
    .messages({
      'date.base': 'End date time must be a valid date',
      'date.format': 'End date time must be in ISO format',
      'date.min': 'End date time must be after start date time',
      'any.required': 'End date time is required',
    }),

  recurrenceType: Joi.string()
    .valid('none', 'daily', 'weekly', 'monthly', 'yearly')
    .default('none')
    .messages({
      'any.only':
        'Recurrence type must be one of: none, daily, weekly, monthly, yearly',
    }),

  recurrenceEndDate: Joi.date()
    .iso()
    .min(Joi.ref('startDateTime'))
    .optional()
    .messages({
      'date.base': 'Recurrence end date must be a valid date',
      'date.format': 'Recurrence end date must be in ISO format',
      'date.min': 'Recurrence end date must be after start date time',
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
    .default(1)
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

  timeZone: Joi.string().trim().max(50).default('UTC').optional().messages({
    'string.max': 'Time zone cannot exceed 50 characters',
  }),

  metadata: Joi.object({
    purpose: Joi.string().trim().max(200).optional().messages({
      'string.max': 'Purpose cannot exceed 200 characters',
    }),

    department: Joi.string().trim().max(100).optional().messages({
      'string.max': 'Department cannot exceed 100 characters',
    }),

    contactEmail: Joi.string().trim().email().max(100).optional().messages({
      'string.email': 'Contact email must be a valid email address',
      'string.max': 'Contact email cannot exceed 100 characters',
    }),

    contactPhone: Joi.string()
      .trim()
      .pattern(/^[\+]?[0-9\s\-\(\)]+$/)
      .max(20)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid contact phone format',
        'string.max': 'Contact phone cannot exceed 20 characters',
      }),

    specialRequirements: Joi.string().trim().max(500).optional().messages({
      'string.max': 'Special requirements cannot exceed 500 characters',
    }),

    estimatedAttendees: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .optional()
      .messages({
        'number.min': 'Estimated attendees must be at least 1',
        'number.max': 'Estimated attendees cannot exceed 1000',
      }),

    isPrivate: Joi.boolean().optional(),

    color: Joi.string()
      .trim()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .messages({
        'string.pattern.base':
          'Color must be a valid hex color code (e.g., #FF0000)',
      }),

    priority: Joi.number().integer().min(1).max(5).optional().messages({
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
  .custom((value, helpers) => {
    // Validate recurrence settings
    if (
      value.recurrenceType === 'weekly' &&
      (!value.daysOfWeek || value.daysOfWeek.length === 0)
    ) {
      return helpers.error('custom.weeklyRecurrence');
    }

    if (value.recurrenceType !== 'none' && !value.recurrenceEndDate) {
      return helpers.error('custom.recurrenceEndDate');
    }

    // Validate booking duration (minimum 15 minutes, maximum 24 hours)
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

    return value;
  }, 'Custom validations')
  .messages({
    'custom.weeklyRecurrence':
      'Days of week must be specified for weekly recurrence',
    'custom.recurrenceEndDate':
      'Recurrence end date must be specified for recurring bookings',
    'custom.minimumDuration': 'Booking duration must be at least 15 minutes',
    'custom.maximumDuration': 'Booking duration cannot exceed 24 hours',
  });
