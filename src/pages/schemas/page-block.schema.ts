import mongoose from 'mongoose';
import { ComponentSize } from '@/common/enums/component-size.enum';
import { DYNAMIC_ENTITY_COLLECTION_MAX_ITEMS } from '@/pages/constants/entity-collection.constants';
import { EntityCollectionItemOrder } from '@/pages/enums/entity-collection-item-order.enum';
import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { BlockButtonType } from '../enums/block-button-type.enum';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { EntityCollectionLayout } from '../enums/entity-collection-layout.enum';
import {
  GROUP_CHILD_BLOCK_TYPES,
  GroupChildBlockType,
  PageBlockType,
} from '../enums/page-block-type.enum';
import { RelatedPeopleDisplay } from '../enums/related-people-display.enum';
import { Languages } from '@/people/enums/languages.enum';

const spacingValues = ['none', 'sm', 'md', 'lg', 'xl'];
const variantValues = ['section', 'block', 'element'];
const buttonStyleValues = ['primary', 'secondary', 'ghost', 'outline', 'link'];
const mediaPositionValues = ['left', 'right', 'top', 'bottom'];
const galleryLayoutValues = ['grid', 'carousel', 'slider'];
const textAlignValues = ['left', 'center', 'right'];
const temporalModeValues = ['upcoming', 'past', 'custom'];

export const blockButtonSchema = new mongoose.Schema(
  {
    isVisible: { type: Boolean },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(BlockButtonType),
    },
    targetId: { type: String },
    applicationProgramId: { type: String },
    applicationEventId: { type: String },
    url: { type: String, trim: true },
    openInNewTab: { type: Boolean, default: false },
    style: { type: String, enum: buttonStyleValues },
    size: { type: String, enum: Object.values(ComponentSize) },
    // Embedded block for type === 'block'. Structure is owned/validated by Joi
    // embeddableBlockSchema (see joi.page-block.schema.ts); Mixed mirrors Page.seo.
    block: { type: mongoose.Schema.Types.Mixed },
    // Optional visible modal heading for block/application actions (Joi enforces).
    modalTitle: { type: String, trim: true },
  },
  { _id: false, id: false },
);

export const htmlButtonSnippetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['button'] },
    button: { type: blockButtonSchema, required: true },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const mediaRefSchema = new mongoose.Schema(
  {
    mediaId: { type: String, required: true },
    alt: { type: String },
    caption: { type: String },
  },
  { _id: false, id: false },
);

export const relatedPeopleGroupSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    peopleIds: { type: [String], required: true, default: [] },
    display: {
      type: String,
      enum: Object.values(RelatedPeopleDisplay),
      default: RelatedPeopleDisplay.Inline,
    },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const heroItemSchema = new mongoose.Schema(
  {
    isVisible: { type: Boolean },
    icon: { type: String },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String },
    buttons: { type: [blockButtonSchema], default: undefined },
    button: { type: blockButtonSchema },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const galleryItemSchema = new mongoose.Schema(
  {
    mediaId: { type: String, required: true },
    title: { type: String },
    subtitle: { type: String },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const customEntityCollectionItemSchema = new mongoose.Schema(
  {
    mediaId: { type: String },
    pretitle: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    description: { type: String, trim: true },
    button: { type: blockButtonSchema },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const pageBlockBaseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(PageBlockType),
    },
    variant: { type: String, enum: variantValues },
    pretitle: { type: String, trim: true },
    title: { type: String, trim: true },
    subtitle: { type: String },
    description: { type: String },
    isVisible: { type: Boolean, default: true },
    anchorId: { type: String },
    theme: { type: String },
    background: { type: String, trim: true, maxlength: 300 },
    padding: { type: String, enum: spacingValues },
    fullWidth: { type: Boolean, default: false },
    textAlign: { type: String, enum: textAlignValues },
  },
  {
    _id: false,
    id: false,
    discriminatorKey: 'type',
    strict: 'throw',
  },
);

export const richTextBlockSchema = new mongoose.Schema(
  {
    media: { type: mediaRefSchema },
    mediaPosition: { type: String, enum: mediaPositionValues },
    buttons: { type: [blockButtonSchema], default: [] },
    relatedPeople: { type: relatedPeopleGroupSchema },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const entityCollectionBlockSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      required: true,
      enum: Object.values(EntityCollectionEntityType),
    },
    layout: {
      type: String,
      required: true,
      enum: Object.values(EntityCollectionLayout),
    },
    items: { type: [String], required: true, default: [] },
    customItems: {
      type: [customEntityCollectionItemSchema],
      default: undefined,
    },
    itemOrder: { type: String, enum: Object.values(EntityCollectionItemOrder) },
    source: { type: String, enum: ['manual', 'dynamic'] },
    filters: {
      type: new mongoose.Schema(
        {
          roles: { type: [String], default: undefined },
          specializations: { type: [String], default: undefined },
          availability: { type: [String], default: undefined },
          workFormats: { type: [String], default: undefined },
          workLocationIds: { type: [String], default: undefined },
          languages: {
            type: [String],
            enum: Object.values(Languages),
            default: undefined,
          },
          types: { type: [String], default: undefined },
          lifecycle: { type: String, enum: ['active'] },
          temporal: {
            type: new mongoose.Schema(
              {
                mode: {
                  type: String,
                  required: true,
                  enum: temporalModeValues,
                },
                from: { type: String },
                to: { type: String },
              },
              { _id: false, id: false, strict: 'throw' },
            ),
          },
          locationIds: { type: [String], default: undefined },
          peopleIds: { type: [String], default: undefined },
        },
        { _id: false, id: false, strict: 'throw' },
      ),
    },
    limit: { type: Number, min: 1, max: DYNAMIC_ENTITY_COLLECTION_MAX_ITEMS },
    cardVariant: { type: String },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const heroBlockSchema = new mongoose.Schema(
  {
    backgroundMedia: { type: mediaRefSchema },
    items: { type: [heroItemSchema], default: [] },
    // Opt-in spacing keeps historical Hero padding values inactive; no migration required.
    sectionSpacing: { type: String, enum: spacingValues },
    columns: { type: Number, enum: [2, 3, 4, 5] },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const ctaBlockSchema = new mongoose.Schema(
  {
    buttons: { type: [blockButtonSchema], required: true, default: [] },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const galleryBlockSchema = new mongoose.Schema(
  {
    layout: { type: String, enum: galleryLayoutValues },
    items: { type: [galleryItemSchema], required: true, default: [] },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const applicationFormBlockSchema = new mongoose.Schema(
  {
    applicationType: {
      type: String,
      required: true,
      enum: Object.values(ApplicationFormType),
    },
    successMessage: { type: String },
    buttonLabel: { type: String },
  },
  { _id: false, id: false, strict: 'throw' },
);

const htmlBlockTemplateValues = [
  'vertical',
  'horizontal-left',
  'horizontal-right',
];

export const htmlBlockSchema = new mongoose.Schema(
  {
    template: {
      type: String,
      enum: htmlBlockTemplateValues,
      default: 'vertical',
    },
    content: { type: String, required: true },
    snippets: { type: [htmlButtonSnippetSchema], default: undefined },
  },
  { _id: false, id: false, strict: 'throw' },
);

// Group block (pages only). Discriminators are registered on a per-path scope
// keyed off the array's base *instance*. pageBlockBaseSchema is shared by the
// page and event top-level arrays, so registering `group` on it would leak group
// onto events. To keep group page-only AND cap nesting, both the page-root array
// and the group's nested-children array use their own pristine clones (verified:
// mongoose accepts the same delta instances on independent clone bases).

// Group children: only the 6 eligible types (no hero, no group) → nested group
// and hero children are rejected at persistence, matching Joi.
const groupChildBaseSchema = pageBlockBaseSchema.clone();

export const groupBlockSchema = new mongoose.Schema(
  {
    blocks: { type: [groupChildBaseSchema], default: [] },
  },
  { _id: false, id: false, strict: 'throw' },
);

const groupChildrenPath = groupBlockSchema.path(
  'blocks',
) as mongoose.Schema.Types.DocumentArray;

// Register the eligible child discriminators from the shared eligibility list so
// this can't drift from Joi / the editor. The full Record (not Partial) makes a
// missing schema entry a compile error rather than a silently-dropped type.
const groupChildDeltaSchemas: Record<GroupChildBlockType, mongoose.Schema> = {
  [PageBlockType.RichText]: richTextBlockSchema,
  [PageBlockType.EntityCollection]: entityCollectionBlockSchema,
  [PageBlockType.Cta]: ctaBlockSchema,
  [PageBlockType.Gallery]: galleryBlockSchema,
  [PageBlockType.ApplicationForm]: applicationFormBlockSchema,
  [PageBlockType.Html]: htmlBlockSchema,
};

for (const childType of GROUP_CHILD_BLOCK_TYPES) {
  groupChildrenPath.discriminator(childType, groupChildDeltaSchemas[childType]);
}

// Page-root array base — an isolated clone so page.schema.ts can register the
// `group` discriminator here WITHOUT it leaking onto the shared
// pageBlockBaseSchema that events still use.
export const pageRootBlockBaseSchema = pageBlockBaseSchema.clone();
