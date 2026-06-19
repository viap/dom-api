import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiSeoSchema } from '@/common/schemas/joi.seo.schema';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';
import { PageStatus } from '../enums/page-status.enum';
import { pageBlocksSchema } from './joi.page-block.schema';

export const createPageSchema = Joi.object({
  domainId: joiObjectId.optional(),
  slug: joiSlugSchema.required(),
  title: Joi.string().trim().min(1).max(150).required(),
  status: Joi.string()
    .valid(...Object.values(PageStatus))
    .default(PageStatus.Draft)
    .optional(),
  isHomepage: Joi.boolean().default(false).optional(),
  isTitleVisible: Joi.boolean().default(true).optional(),
  seo: joiSeoSchema.optional(),
  blocks: pageBlocksSchema.optional(),
});
