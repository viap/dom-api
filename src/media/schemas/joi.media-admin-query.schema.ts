import * as Joi from 'joi';
import { MediaKind } from '../enums/media-kind.enum';

export const mediaAdminQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  kind: Joi.string()
    .valid(...Object.values(MediaKind))
    .optional(),
  search: Joi.string().trim().max(150).optional(),
  createdFrom: Joi.string().isoDate().optional(),
  createdTo: Joi.string().isoDate().optional(),
});
