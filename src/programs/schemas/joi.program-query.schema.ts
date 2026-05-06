import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';

export const programQuerySchema = Joi.object({
  domainId: joiObjectId.required(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});
