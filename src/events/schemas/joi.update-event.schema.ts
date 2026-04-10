import * as Joi from 'joi';
import { joiPriceSchema } from '@/common/schemas/joi.price.schema';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';

const objectIdArraySchema = Joi.array().items(Joi.string().hex().length(24));

export const updateEventSchema = Joi.object({
  domainId: Joi.string().hex().length(24).optional(),

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

  locationId: Joi.string().hex().length(24).optional(),

  speakerIds: objectIdArraySchema.optional(),
  organizerIds: objectIdArraySchema.optional(),
  partnerIds: objectIdArraySchema.optional(),

  registration: Joi.object({
    isOpen: Joi.boolean().optional(),
    maxParticipants: Joi.number().integer().min(1).optional(),
    deadline: Joi.number().integer().optional(),
  }).optional(),

  price: joiPriceSchema.optional(),
  capacity: Joi.number().integer().min(1).optional(),
}).min(1);
