import * as Joi from 'joi';
import {
  EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH,
  EVENT_SCHEDULE_MAX_DAYS,
  EVENT_SCHEDULE_TIMEZONE,
} from '../types/event-schedule.interface';
import {
  EventScheduleValidationError,
  normalizeEventSchedule,
} from '../utils/event-schedule';

export const joiEventScheduleSchema = Joi.object({
  timezone: Joi.string().valid(EVENT_SCHEDULE_TIMEZONE).optional(),
  days: Joi.array()
    .items(
      Joi.object({
        date: Joi.string().trim().required(),
        startTime: Joi.string().trim().required(),
        endTime: Joi.string().trim().required(),
        description: Joi.string()
          .trim()
          .max(EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH)
          .allow('')
          .optional(),
      }),
    )
    .min(1)
    .max(EVENT_SCHEDULE_MAX_DAYS)
    .required(),
}).custom((value, helpers) => {
  try {
    return normalizeEventSchedule(value).schedule;
  } catch (error) {
    if (error instanceof EventScheduleValidationError) {
      return helpers.error('any.invalid');
    }
    throw error;
  }
}, 'event schedule validation');
