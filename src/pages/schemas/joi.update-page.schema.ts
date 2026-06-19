import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { joiSeoSchema } from '@/common/schemas/joi.seo.schema';
import { joiSlugSchema } from '@/common/schemas/joi.slug.schema';
import { PageStatus } from '../enums/page-status.enum';
import { pageBlocksSchema } from './joi.page-block.schema';

export const updatePageSchema = Joi.object({
  domainId: Joi.alternatives().try(joiObjectId, Joi.valid(null)).optional(),
  slug: joiSlugSchema.optional(),
  title: Joi.string().trim().min(1).max(150).optional(),
  status: Joi.string()
    .valid(...Object.values(PageStatus))
    .optional(),
  isHomepage: Joi.boolean().optional(),
  isTitleVisible: Joi.boolean().optional(),
  seo: joiSeoSchema.optional(),
  blocks: pageBlocksSchema.optional(),
});
