import * as Joi from 'joi';
import { joiUtcIsoDateTime } from '@/common/schemas/joi.datetime.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiPriceGroupSchema } from '@/common/schemas/joi.price-group.schema';
import { joiSeoSchema } from '@/common/schemas/joi.seo.schema';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';
import { pageBlocksSchema } from '@/pages/schemas/joi.page-block.schema';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';
import {
  EventScheduleValidationError,
  normalizeEventSchedule,
} from '../utils/event-schedule';
import { joiEventScheduleSchema } from './joi.event-schedule.schema';

export const createEventSchema = Joi.object({
  domainId: joiObjectId.required(),

  type: Joi.string()
    .valid(...Object.values(EventType))
    .required(),

  status: Joi.string()
    .valid(...Object.values(EventStatus))
    .default(EventStatus.Draft)
    .optional(),

  title: Joi.string().trim().min(1).max(150).required(),

  description: Joi.string().trim().max(2000).allow('').optional(),

  slug: joiSlugSchema.required(),

  startAt: joiUtcIsoDateTime.optional(),
  endAt: joiUtcIsoDateTime.optional(),
  schedule: joiEventScheduleSchema.optional(),

  locationId: joiObjectId.optional(),
  mediaId: joiObjectId.optional(),

  speakerIds: Joi.array().items(joiObjectId).default([]),
  organizerIds: Joi.array().items(joiObjectId).default([]),
  partnerIds: Joi.array().items(joiObjectId).default([]),

  registration: Joi.object({
    isOpen: Joi.boolean().default(false).optional(),
    maxParticipants: Joi.number().integer().min(1).optional(),
    deadline: joiUtcIsoDateTime.optional(),
  })
    .default({ isOpen: false })
    .optional(),

  program: Joi.array()
    .items(
      Joi.object({
        time: Joi.string().trim().max(20).required(),
        title: Joi.string().trim().min(1).max(200).required(),
        note: Joi.string().trim().max(500).allow('').optional(),
      }),
    )
    .max(50)
    .default([])
    .optional(),

  learnings: Joi.array()
    .items(Joi.string().trim().min(1).max(300))
    .max(50)
    .default([])
    .optional(),

  priceGroups: Joi.array().items(joiPriceGroupSchema).optional(),
  capacity: Joi.number().integer().min(1).optional(),

  seo: joiSeoSchema.optional(),
  blocks: pageBlocksSchema.optional(),
})
  .custom((value, helpers) => {
    const hasSchedule = value.schedule !== undefined;
    const hasStartAt = value.startAt !== undefined;
    const hasEndAt = value.endAt !== undefined;
    let activeStartAt = value.startAt;

    if (hasSchedule) {
      if (hasStartAt || hasEndAt) {
        return helpers.error('any.invalid');
      }

      try {
        activeStartAt = normalizeEventSchedule(value.schedule).startAt;
      } catch (error) {
        if (error instanceof EventScheduleValidationError) {
          return helpers.error('any.invalid');
        }
        throw error;
      }
    } else if (!hasStartAt || !hasEndAt) {
      return helpers.error('any.invalid');
    }

    const startAt = new Date(activeStartAt).getTime();
    const endAt = new Date(value.endAt).getTime();

    if (!hasSchedule && endAt <= startAt) {
      return helpers.error('any.invalid');
    }

    const registrationDeadline = value.registration?.deadline;
    if (registrationDeadline) {
      const deadline = new Date(registrationDeadline).getTime();
      if (deadline > startAt) {
        return helpers.error('any.invalid');
      }
    }

    return value;
  }, 'event temporal ordering validation')
  .messages({
    'any.invalid':
      'endAt must be after startAt and registration.deadline must be before or equal to startAt',
  });
