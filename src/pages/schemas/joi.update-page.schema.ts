import * as Joi from 'joi';
import { PageStatus } from '../enums/page-status.enum';
import { pageBlocksSchema } from './joi.page-block.schema';

export const updatePageSchema = Joi.object({
  domainId: Joi.alternatives()
    .try(Joi.string().hex().length(24), Joi.valid(null))
    .optional(),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(1)
    .max(120)
    .optional(),
  title: Joi.string().trim().min(1).max(150).optional(),
  status: Joi.string()
    .valid(...Object.values(PageStatus))
    .optional(),
  seo: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  blocks: pageBlocksSchema.optional(),
});
