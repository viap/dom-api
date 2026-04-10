import * as Joi from 'joi';
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

const objectIdArraySchema = Joi.array()
  .items(Joi.string().hex().length(24))
  .default([]);

export const createProgramSchema = Joi.object({
  domainId: Joi.string().hex().length(24).required(),

  kind: Joi.string()
    .valid(...Object.values(ProgramKind))
    .required(),

  status: Joi.string()
    .valid(...Object.values(ProgramStatus))
    .default(ProgramStatus.Draft)
    .optional(),

  title: Joi.string().trim().min(1).max(150).required(),

  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(1)
    .max(120)
    .required(),

  startDate: Joi.number().integer().optional(),
  endDate: Joi.number().integer().optional(),
  applicationDeadline: Joi.number().integer().optional(),

  format: Joi.string()
    .valid(...Object.values(ProgramFormat))
    .required(),

  price: joiPriceSchema.optional(),

  modules: Joi.array().items(joiProgramModuleSchema).default([]),
  speakerIds: objectIdArraySchema,
  organizerIds: objectIdArraySchema,
  partnerIds: objectIdArraySchema,
});
