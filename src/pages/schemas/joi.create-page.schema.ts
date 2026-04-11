import * as Joi from 'joi';
import { PageStatus } from '../enums/page-status.enum';
import { pageBlocksSchema } from './joi.page-block.schema';

export const createPageSchema = Joi.object({
  domainId: Joi.string().hex().length(24).optional(),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(1)
    .max(120)
    .required(),
  title: Joi.string().trim().min(1).max(150).required(),
  status: Joi.string()
    .valid(...Object.values(PageStatus))
    .default(PageStatus.Draft)
    .optional(),
  seo: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  blocks: pageBlocksSchema.optional(),
});
