import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { PageStatus } from '../enums/page-status.enum';
import { pageBlocksSchema } from './joi.page-block.schema';

const seoSchema = Joi.object()
  .pattern(Joi.string().trim().max(100), Joi.string().trim().max(300))
  .max(20);

export const createPageSchema = Joi.object({
  domainId: joiObjectId.optional(),
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
  seo: seoSchema.optional(),
  blocks: pageBlocksSchema.optional(),
});
