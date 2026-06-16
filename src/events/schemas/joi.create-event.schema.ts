import * as Joi from 'joi';
import { joiUtcIsoDateTime } from '@/common/schemas/joi.datetime.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiPriceGroupSchema } from '@/common/schemas/joi.price-group.schema';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';

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

  startAt: joiUtcIsoDateTime.required(),
  endAt: joiUtcIsoDateTime.required(),

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

  priceGroups: Joi.array().items(joiPriceGroupSchema).optional(),
  capacity: Joi.number().integer().min(1).optional(),
})
  .custom((value, helpers) => {
    const startAt = new Date(value.startAt).getTime();
    const endAt = new Date(value.endAt).getTime();

    if (endAt <= startAt) {
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
