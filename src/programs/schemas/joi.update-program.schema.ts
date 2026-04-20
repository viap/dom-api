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

  startDate: joiUtcIsoDateTime.optional(),
  endDate: joiUtcIsoDateTime.optional(),
  applicationDeadline: joiUtcIsoDateTime.optional(),

  format: Joi.string()
    .valid(...Object.values(ProgramFormat))
    .optional(),

  priceGroups: Joi.array().items(joiPriceGroupSchema).optional(),

  modules: Joi.array().items(joiProgramModuleSchema).optional(),
  speakerIds: Joi.array().items(joiObjectId).optional(),
  organizerIds: Joi.array().items(joiObjectId).optional(),
  partnerIds: Joi.array().items(joiObjectId).optional(),
})
  .custom((value, helpers) => {
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
  }, 'program temporal ordering validation')
  .messages({
    'any.invalid':
      'endDate must be after or equal to startDate and applicationDeadline must be before or equal to startDate',
  })
  .min(1);
