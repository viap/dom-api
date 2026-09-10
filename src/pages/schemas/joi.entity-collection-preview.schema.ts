import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { pageBlockSchema } from './joi.page-block.schema';

// Reuse the persisted Dynamic block validation so preview and saved blocks
// cannot drift into different filter contracts.
export const entityCollectionPreviewSchema = Joi.object({
  entityType: Joi.string()
    .valid(...Object.values(EntityCollectionEntityType))
    .required(),
  filters: Joi.object().required(),
  limit: Joi.number().integer().min(1).max(24).default(12).optional(),
  contextDomainId: joiObjectId.allow(null).required(),
})
  .custom((value, helpers) => {
    const validation = pageBlockSchema.validate({
      id: 'preview',
      type: 'entityCollection',
      entityType: value.entityType,
      layout: 'grid',
      source: 'dynamic',
      items: [],
      filters: value.filters,
      limit: value.limit,
    });
    return validation.error ? helpers.error('any.invalid') : value;
  })
  .messages({ 'any.invalid': 'Invalid entity collection preview filters' });
