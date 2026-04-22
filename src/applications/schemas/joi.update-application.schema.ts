import * as Joi from 'joi';
import { joiUtcIsoDateTime } from '@/common/schemas/joi.datetime.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { ApplicationStatus } from '../enums/application-status.enum';

export const updateApplicationSchema = Joi.object({
  domainId: joiObjectId.optional(),

  status: Joi.string()
    .valid(...Object.values(ApplicationStatus))
    .optional(),

  assignedTo: joiObjectId.optional(),

  source: Joi.object({
    entityType: Joi.string().valid('program', 'event', 'partner').optional(),
    entityId: joiObjectId.optional(),
    utm: Joi.object()
      .pattern(Joi.string().max(50), Joi.string().max(200))
      .optional(),
  }).optional(),

  payload: Joi.object()
    .pattern(
      Joi.string().max(50),
      Joi.alternatives().try(
        Joi.string().max(1000),
        Joi.number(),
        Joi.boolean(),
        Joi.array(),
        Joi.object(),
      ),
    )
    .optional(),

  notes: Joi.array()
    .items(
      Joi.object({
        text: Joi.string().trim().min(1).max(1000).required(),
        authorId: joiObjectId.required(),
        createdAt: joiUtcIsoDateTime.required(),
      }),
    )
    .max(200)
    .optional(),
}).min(1);
