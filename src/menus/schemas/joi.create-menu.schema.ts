import * as Joi from 'joi';
import { joiObjectId } from '@/common/schemas/joi.object-id.schema';
import { MenuItemType } from '../enums/menu-item-type.enum';

const slugSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9-]+$/)
  .min(1)
  .max(120);

const buildItemSchema = (allowChildren: boolean): Joi.ObjectSchema => {
  return Joi.object({
    id: Joi.string().trim().max(100).optional(),
    title: Joi.string().trim().min(1).max(150).required(),
    type: Joi.string()
      .valid(...Object.values(MenuItemType))
      .required(),
    targetId: joiObjectId.optional(),
    url: Joi.string().uri().optional(),
    order: Joi.number().integer().min(0).required(),
    children: allowChildren
      ? Joi.array().items(buildItemSchema(false)).default([])
      : Joi.forbidden(),
    isVisible: Joi.boolean().default(true).optional(),
    openInNewTab: Joi.boolean().default(false).optional(),
  }).custom((value, helpers) => {
    if (value.type === MenuItemType.External) {
      if (!value.url) {
        return helpers.error('any.custom', {
          message: 'External menu item requires url',
        });
      }
      if (value.targetId) {
        return helpers.error('any.custom', {
          message: 'External menu item must not include targetId',
        });
      }
    }

    if (
      value.type === MenuItemType.Domain ||
      value.type === MenuItemType.Page
    ) {
      if (!value.targetId) {
        return helpers.error('any.custom', {
          message: `${value.type} menu item requires targetId`,
        });
      }
      if (value.url) {
        return helpers.error('any.custom', {
          message: `${value.type} menu item must not include url`,
        });
      }
    }

    return value;
  }, 'menu item validation');
};

export const createMenuSchema = Joi.object({
  key: slugSchema.required(),
  title: Joi.string().trim().min(1).max(150).required(),
  domainId: joiObjectId.optional(),
  isActive: Joi.boolean().default(true).optional(),
  items: Joi.array().items(buildItemSchema(true)).default([]),
});
