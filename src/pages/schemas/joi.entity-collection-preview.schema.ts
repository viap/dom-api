import * as Joi from 'joi';
import { EntityCollectionItemOrder } from '@/pages/enums/entity-collection-item-order.enum';
import { DYNAMIC_ENTITY_COLLECTION_MAX_ITEMS } from '@/pages/constants/entity-collection.constants';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { pageBlockSchema } from './joi.page-block.schema';

// Reuse the persisted Dynamic block validation so preview and saved blocks
// cannot drift into different filter contracts.
export const entityCollectionPreviewSchema = Joi.object({
  itemOrder: Joi.string()
    .valid(...Object.values(EntityCollectionItemOrder))
    .optional(),
  blockId: Joi.string().trim().min(1).max(100).optional(),
  blockPath: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .min(1)
    .max(32)
    .when('itemOrder', {
      is: EntityCollectionItemOrder.Random,
      then: Joi.required(),
    }),
  owner: Joi.alternatives()
    .try(
      Joi.object({
        kind: Joi.string().valid('page', 'persistedPage').required(),
        pageId: joiObjectId.required(),
      }),
      Joi.object({
        kind: Joi.string().valid('draftPage').required(),
        draftToken: Joi.string().trim().min(1).max(100).required(),
      }),
    )
    .when('itemOrder', {
      is: EntityCollectionItemOrder.Random,
      then: Joi.required(),
    }),
  entityType: Joi.string()
    .valid(
      EntityCollectionEntityType.People,
      EntityCollectionEntityType.Partners,
      EntityCollectionEntityType.Events,
    )
    .required(),
  filters: Joi.object().required(),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(DYNAMIC_ENTITY_COLLECTION_MAX_ITEMS)
    .default(12)
    .optional(),
  contextDomainId: joiObjectId.allow(null).required(),
})
  .custom((value, helpers) => {
    if (
      value.blockId &&
      value.blockPath &&
      value.blockPath[value.blockPath.length - 1] !== value.blockId
    ) {
      return helpers.error('any.invalid');
    }
    if (value.owner?.kind === 'persistedPage')
      value.owner = { ...value.owner, kind: 'page' };
    const validation = pageBlockSchema.validate({
      id: 'preview',
      itemOrder: value.itemOrder,
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
