import * as Joi from 'joi';
import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { BlockButtonType } from '../enums/block-button-type.enum';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { EntityCollectionLayout } from '../enums/entity-collection-layout.enum';
import { PageBlockType } from '../enums/page-block-type.enum';
import { RelatedPeopleDisplay } from '../enums/related-people-display.enum';

const objectIdSchema = Joi.string().hex().length(24);
const stringSchema = Joi.string().trim().max(5000);
const spacingSchema = Joi.string().valid('none', 'sm', 'md', 'lg', 'xl');
const variantSchema = Joi.string().valid('section', 'block', 'element');
const attributeTokenSchema = Joi.string()
  .trim()
  .min(1)
  .max(120)
  .pattern(/^[a-zA-Z0-9_-]+$/);

const blockButtonSchema = Joi.object({
  label: Joi.string().trim().min(1).max(150).required(),
  type: Joi.string()
    .valid(...Object.values(BlockButtonType))
    .required(),
  targetId: Joi.string().trim().max(120).optional(),
  url: Joi.string().trim().uri().optional(),
  openInNewTab: Joi.boolean().default(false).optional(),
  style: Joi.string().valid('primary', 'secondary', 'ghost', 'link').optional(),
})
  .custom((value, helpers) => {
    if (value.type === BlockButtonType.External) {
      if (!value.url) {
        return helpers.error('any.custom', {
          message: 'External buttons require url',
        });
      }
      if (value.targetId) {
        return helpers.error('any.custom', {
          message: 'External buttons must not include targetId',
        });
      }
    } else {
      if (!value.targetId) {
        return helpers.error('any.custom', {
          message: 'Internal buttons require targetId',
        });
      }
      if (value.url) {
        return helpers.error('any.custom', {
          message: 'Internal buttons must not include url',
        });
      }
      if (
        (value.type === BlockButtonType.Page ||
          value.type === BlockButtonType.Domain) &&
        !objectIdSchema.validate(value.targetId).error
      ) {
        return value;
      }
      if (
        value.type === BlockButtonType.Page ||
        value.type === BlockButtonType.Domain
      ) {
        return helpers.error('any.custom', {
          message: `${value.type} buttons require a valid ObjectId targetId`,
        });
      }
    }

    return value;
  })
  .messages({ 'any.custom': '{{#message}}' });

const mediaRefSchema = Joi.object({
  mediaId: objectIdSchema.required(),
  alt: Joi.string().trim().max(300).optional(),
  caption: Joi.string().trim().max(500).optional(),
});

const relatedPeopleGroupSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).required(),
  peopleIds: Joi.array().items(objectIdSchema).min(1).required(),
  display: Joi.string()
    .valid(...Object.values(RelatedPeopleDisplay))
    .default(RelatedPeopleDisplay.Inline)
    .optional(),
});

const pageBlockBaseSchema = {
  id: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string()
    .valid(...Object.values(PageBlockType))
    .required(),
  variant: variantSchema.optional(),
  title: Joi.string().trim().min(1).max(150).optional(),
  subtitle: Joi.string().trim().min(1).max(300).optional(),
  description: stringSchema.optional(),
  isVisible: Joi.boolean().default(true).optional(),
  anchorId: attributeTokenSchema.optional(),
  theme: attributeTokenSchema.optional(),
  paddingTop: spacingSchema.optional(),
  paddingBottom: spacingSchema.optional(),
};

const richTextBlockSchema = Joi.object({
  ...pageBlockBaseSchema,
  type: Joi.string().valid(PageBlockType.RichText).required(),
  media: mediaRefSchema.optional(),
  mediaPosition: Joi.string()
    .valid('left', 'right', 'top', 'bottom')
    .optional(),
  buttons: Joi.array().items(blockButtonSchema).optional(),
  relatedPeople: relatedPeopleGroupSchema.optional(),
});

const entityCollectionBlockSchema = Joi.object({
  ...pageBlockBaseSchema,
  type: Joi.string().valid(PageBlockType.EntityCollection).required(),
  entityType: Joi.string()
    .valid(...Object.values(EntityCollectionEntityType))
    .required(),
  layout: Joi.string()
    .valid(...Object.values(EntityCollectionLayout))
    .required(),
  items: Joi.array().items(objectIdSchema).min(1).max(50).required(),
  cardVariant: Joi.string().trim().max(120).optional(),
});

const heroItemSchema = Joi.object({
  icon: Joi.string().trim().max(120).optional(),
  title: Joi.string().trim().min(1).max(150).required(),
  subtitle: Joi.string().trim().min(1).max(300).optional(),
  button: blockButtonSchema.optional(),
});

const heroBlockSchema = Joi.object({
  ...pageBlockBaseSchema,
  type: Joi.string().valid(PageBlockType.Hero).required(),
  backgroundMedia: mediaRefSchema.optional(),
  overlayStyle: Joi.string().trim().max(120).optional(),
  buttons: Joi.array().items(blockButtonSchema).optional(),
  items: Joi.array().items(heroItemSchema).optional(),
});

const ctaBlockSchema = Joi.object({
  ...pageBlockBaseSchema,
  type: Joi.string().valid(PageBlockType.Cta).required(),
  backgroundStyle: Joi.string().trim().max(120).optional(),
  buttons: Joi.array().items(blockButtonSchema).min(1).required(),
});

const galleryBlockSchema = Joi.object({
  ...pageBlockBaseSchema,
  type: Joi.string().valid(PageBlockType.Gallery).required(),
  layout: Joi.string().valid('grid', 'masonry', 'slider').optional(),
  items: Joi.array()
    .items(
      Joi.object({
        mediaId: objectIdSchema.required(),
        title: Joi.string().trim().min(1).max(150).optional(),
        subtitle: Joi.string().trim().min(1).max(300).optional(),
      }),
    )
    .min(1)
    .required(),
});

const applicationFormBlockSchema = Joi.object({
  ...pageBlockBaseSchema,
  type: Joi.string().valid(PageBlockType.ApplicationForm).required(),
  applicationType: Joi.string()
    .valid(...Object.values(ApplicationFormType))
    .required(),
  successMessage: Joi.string().trim().max(500).optional(),
  buttonLabel: Joi.string().trim().min(1).max(150).optional(),
});

export const pageBlockSchema = Joi.alternatives()
  .try(
    richTextBlockSchema,
    entityCollectionBlockSchema,
    heroBlockSchema,
    ctaBlockSchema,
    galleryBlockSchema,
    applicationFormBlockSchema,
  )
  .required();

export const pageBlocksSchema = Joi.array().items(pageBlockSchema).max(20);
