import * as Joi from 'joi';
import { joiPriceSchema } from '@/common/schemas/joi.price.schema';
import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';

const objectIdArraySchema = Joi.array()
  .items(Joi.string().hex().length(24))
  .default([]);

export const createEventSchema = Joi.object({
  domainId: Joi.string().hex().length(24).required(),

  type: Joi.string()
    .valid(...Object.values(EventType))
    .required(),

  status: Joi.string()
    .valid(...Object.values(EventStatus))
    .default(EventStatus.Draft)
    .optional(),

  title: Joi.string().trim().min(1).max(150).required(),

  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(1)
    .max(120)
    .required(),

  startAt: Joi.number().integer().required(),
  endAt: Joi.number().integer().required(),

  locationId: Joi.string().hex().length(24).optional(),

  speakerIds: objectIdArraySchema,
  organizerIds: objectIdArraySchema,
  partnerIds: objectIdArraySchema,

  registration: Joi.object({
    isOpen: Joi.boolean().default(false).optional(),
    maxParticipants: Joi.number().integer().min(1).optional(),
    deadline: Joi.number().integer().optional(),
  })
    .default({ isOpen: false })
    .optional(),

  price: joiPriceSchema.optional(),
  capacity: Joi.number().integer().min(1).optional(),
});
