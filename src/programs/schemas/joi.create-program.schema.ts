import * as Joi from 'joi';
import { joiUtcIsoDateTime } from '@/common/schemas/joi.datetime.schema';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiPriceGroupSchema } from '@/common/schemas/joi.price-group.schema';
import { ProgramFormat } from '../enums/program-format.enum';
import { ProgramKind } from '../enums/program-kind.enum';
import { ProgramStatus } from '../enums/program-status.enum';

const joiProgramModuleSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).required(),
  description: Joi.string().trim().max(1000).allow('').optional(),
  order: Joi.number().integer().min(0).required(),
  durationHours: Joi.number().min(0).optional(),
});

export const createProgramSchema = Joi.object({
  domainId: joiObjectId.required(),

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

  startDate: joiUtcIsoDateTime.optional(),
  endDate: joiUtcIsoDateTime.optional(),
  applicationDeadline: joiUtcIsoDateTime.optional(),

  format: Joi.string()
    .valid(...Object.values(ProgramFormat))
    .required(),

  priceGroups: Joi.array().items(joiPriceGroupSchema).optional(),

  modules: Joi.array().items(joiProgramModuleSchema).default([]),
  speakerIds: Joi.array().items(joiObjectId).default([]),
  organizerIds: Joi.array().items(joiObjectId).default([]),
  partnerIds: Joi.array().items(joiObjectId).default([]),
}).custom((value, helpers) => {
  if (value.startDate && value.endDate) {
    const startDate = new Date(value.startDate).getTime();
    const endDate = new Date(value.endDate).getTime();

    if (endDate < startDate) {
      return helpers.error('any.invalid');
    }
  }

  if (value.applicationDeadline && value.startDate) {
    const startDate = new Date(value.startDate).getTime();
    const applicationDeadline = new Date(value.applicationDeadline).getTime();

    if (applicationDeadline > startDate) {
      return helpers.error('any.invalid');
    }
  }

  return value;
}, 'program temporal ordering validation').messages({
  'any.invalid':
    'endDate must be after or equal to startDate and applicationDeadline must be before or equal to startDate',
});
