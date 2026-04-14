import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiPriceSchema } from '@/common/schemas/joi.price.schema';
import { ProgramFormat } from '../enums/program-format.enum';
import { ProgramKind } from '../enums/program-kind.enum';
import { ProgramStatus } from '../enums/program-status.enum';

const joiProgramModuleSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).required(),
  description: Joi.string().trim().max(1000).allow('').optional(),
  order: Joi.number().integer().min(0).required(),
  durationHours: Joi.number().min(0).optional(),
});

export const updateProgramSchema = Joi.object({
  domainId: joiObjectId.optional(),

  kind: Joi.string()
    .valid(...Object.values(ProgramKind))
    .optional(),

  status: Joi.string()
    .valid(...Object.values(ProgramStatus))
    .optional(),

  title: Joi.string().trim().min(1).max(150).optional(),

  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(1)
    .max(120)
    .optional(),

  startDate: Joi.number().integer().optional(),
  endDate: Joi.number().integer().optional(),
  applicationDeadline: Joi.number().integer().optional(),

  format: Joi.string()
    .valid(...Object.values(ProgramFormat))
    .optional(),

  price: joiPriceSchema.optional(),

  modules: Joi.array().items(joiProgramModuleSchema).optional(),
  speakerIds: Joi.array().items(joiObjectId).optional(),
  organizerIds: Joi.array().items(joiObjectId).optional(),
  partnerIds: Joi.array().items(joiObjectId).optional(),
}).min(1);
