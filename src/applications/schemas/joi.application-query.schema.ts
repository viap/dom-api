import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { ApplicationFormType } from '../enums/application-form-type.enum';
import { ApplicationStatus } from '../enums/application-status.enum';

export const applicationQuerySchema = Joi.object({
  domainId: joiObjectId.optional(),
  formType: Joi.string()
    .valid(...Object.values(ApplicationFormType))
    .optional(),
  status: Joi.string()
    .valid(...Object.values(ApplicationStatus))
    .optional(),
  assignedTo: joiObjectId.optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});
