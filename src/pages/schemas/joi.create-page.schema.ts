import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { PageStatus } from '../enums/page-status.enum';
import { pageBlocksSchema } from './joi.page-block.schema';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';

const seoSchema = Joi.object()
  .pattern(Joi.string().trim().max(100), Joi.string().trim().max(300))
  .max(20);

export const createPageSchema = Joi.object({
  domainId: joiObjectId.optional(),
  slug: joiSlugSchema.required(),
  title: Joi.string().trim().min(1).max(150).required(),
  status: Joi.string()
    .valid(...Object.values(PageStatus))
    .default(PageStatus.Draft)
    .optional(),
  isHomepage: Joi.boolean().default(false).optional(),
  seo: seoSchema.optional(),
  blocks: pageBlocksSchema.optional(),
});
