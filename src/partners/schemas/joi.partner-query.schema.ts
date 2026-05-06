import * as Joi from 'joi';
import { PartnerType } from '../enums/partner-type.enum';

export const partnerQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  title: Joi.string().trim().max(150).optional(),
  type: Joi.string()
    .valid(...Object.values(PartnerType))
    .optional(),
});
