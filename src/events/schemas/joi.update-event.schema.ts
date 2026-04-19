import * as Joi from 'joi';
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

  startAt: Joi.number().integer().optional(),
  endAt: Joi.number().integer().optional(),

  locationId: joiObjectId.optional(),

  speakerIds: Joi.array().items(joiObjectId).optional(),
  organizerIds: Joi.array().items(joiObjectId).optional(),
  partnerIds: Joi.array().items(joiObjectId).optional(),

  registration: Joi.object({
    isOpen: Joi.boolean().optional(),
    maxParticipants: Joi.number().integer().min(1).optional(),
    deadline: Joi.number().integer().optional(),
  }).optional(),

  priceGroups: Joi.array().items(joiPriceGroupSchema).optional(),
  capacity: Joi.number().integer().min(1).optional(),
}).min(1);
