import * as Joi from 'joi';
import { joiUtcIsoDateTime } from '@/common/schemas/joi.datetime.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiPriceGroupSchema } from '@/common/schemas/joi.price-group.schema';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';

export const updateEventSchema = Joi.object({
  domainId: joiObjectId.optional(),

  type: Joi.string()
    .valid(...Object.values(EventType))
    .optional(),

  status: Joi.string()
    .valid(...Object.values(EventStatus))
    .optional(),

  title: Joi.string().trim().min(1).max(150).optional(),

  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(1)
    .max(120)
    .optional(),

  startAt: joiUtcIsoDateTime.optional(),
  endAt: joiUtcIsoDateTime.optional(),

  locationId: joiObjectId.optional(),
  mediaId: joiObjectId.optional(),

  speakerIds: Joi.array().items(joiObjectId).optional(),
  organizerIds: Joi.array().items(joiObjectId).optional(),
  partnerIds: Joi.array().items(joiObjectId).optional(),

  registration: Joi.object({
    isOpen: Joi.boolean().optional(),
    maxParticipants: Joi.number().integer().min(1).optional(),
    deadline: joiUtcIsoDateTime.optional(),
  }).optional(),

  priceGroups: Joi.array().items(joiPriceGroupSchema).optional(),
  capacity: Joi.number().integer().min(1).optional(),
})
  .custom((value, helpers) => {
    if (value.startAt && value.endAt) {
      const startAt = new Date(value.startAt).getTime();
      const endAt = new Date(value.endAt).getTime();

      if (endAt <= startAt) {
        return helpers.error('any.invalid');
      }
    }

    if (value.registration?.deadline && value.startAt) {
      const startAt = new Date(value.startAt).getTime();
      const deadline = new Date(value.registration.deadline).getTime();

      if (deadline > startAt) {
        return helpers.error('any.invalid');
      }
    }

    return value;
  }, 'event temporal ordering validation')
  .messages({
    'any.invalid':
      'endAt must be after startAt and registration.deadline must be before or equal to startAt',
  })
  .min(1);
