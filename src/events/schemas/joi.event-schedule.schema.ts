import * as Joi from 'joi';
import {
  EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH,
  EVENT_SCHEDULE_MAX_DAYS,
  EVENT_SCHEDULE_MAX_EXCEPTIONS,
  EVENT_SCHEDULE_TIMEZONE,
} from '../types/event-schedule.interface';
import {
  EventScheduleValidationError,
  normalizeEventSchedule,
} from '../utils/event-schedule';

const daySchema = Joi.object({
  date: Joi.string().trim().required(),
  startTime: Joi.string().trim().required(),
  endTime: Joi.string().trim().required(),
  description: Joi.string()
    .trim()
    .max(EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH)
    .allow('')
    .optional(),
});

const manualScheduleSchema = Joi.object({
  timezone: Joi.string().valid(EVENT_SCHEDULE_TIMEZONE).optional(),
  mode: Joi.string().valid('manual').optional(),
  days: Joi.array()
    .items(daySchema)
    .min(1)
    .max(EVENT_SCHEDULE_MAX_DAYS)
    .required(),
});

const recurringScheduleSchema = Joi.object({
  timezone: Joi.string().valid(EVENT_SCHEDULE_TIMEZONE).optional(),
  mode: Joi.string().valid('recurring').required(),
  recurrence: Joi.object({
    unit: Joi.string().valid('week').required(),
    interval: Joi.number().integer().valid(1, 2).required(),
    anchorDate: Joi.string().trim().required(),
    startTime: Joi.string().trim().required(),
    endTime: Joi.string().trim().required(),
    endDate: Joi.string().trim().optional(),
  }).required(),
  cancelledDates: Joi.array()
    .items(Joi.string().trim())
    .max(EVENT_SCHEDULE_MAX_EXCEPTIONS)
    .default([]),
  overrides: Joi.array()
    .items(
      Joi.object({
        date: Joi.string().trim().required(),
        startTime: Joi.string().trim().optional(),
        endTime: Joi.string().trim().optional(),
        description: Joi.string()
          .trim()
          .max(EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH)
          .allow('')
          .optional(),
      }).min(2),
    )
    .max(EVENT_SCHEDULE_MAX_EXCEPTIONS)
    .default([]),
});

export const joiEventScheduleSchema = Joi.alternatives()
  .try(manualScheduleSchema, recurringScheduleSchema)
  .custom((value, helpers) => {
    try {
      return normalizeEventSchedule(value).schedule;
    } catch (error) {
      if (error instanceof EventScheduleValidationError) {
        return helpers.error('any.invalid');
      }
      throw error;
    }
  }, 'event schedule validation');
