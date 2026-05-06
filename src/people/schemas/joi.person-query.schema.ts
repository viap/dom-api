import * as Joi from 'joi';
import { PersonRole } from '../enums/person-role.enum';

export const personQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  fullName: Joi.string().trim().max(150).optional(),
  role: Joi.string()
    .trim()
    .valid(...Object.values(PersonRole))
    .optional(),
});
