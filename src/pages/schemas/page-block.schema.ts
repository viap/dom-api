import mongoose from 'mongoose';
import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { BlockButtonType } from '../enums/block-button-type.enum';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { EntityCollectionLayout } from '../enums/entity-collection-layout.enum';
import { PageBlockType } from '../enums/page-block-type.enum';
import { RelatedPeopleDisplay } from '../enums/related-people-display.enum';

const spacingValues = ['none', 'sm', 'md', 'lg', 'xl'];
const variantValues = ['section', 'block', 'element'];
const buttonStyleValues = ['primary', 'secondary', 'ghost', 'outline', 'link'];
const mediaPositionValues = ['left', 'right', 'top', 'bottom'];
const galleryLayoutValues = ['grid', 'masonry', 'slider'];

export const blockButtonSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(BlockButtonType),
    },
    targetId: { type: String },
    url: { type: String, trim: true },
    openInNewTab: { type: Boolean, default: false },
    style: { type: String, enum: buttonStyleValues },
  },
  { _id: false, id: false },
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
    icon: { type: String },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String },
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

export const pageBlockBaseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(PageBlockType),
    },
    variant: { type: String, enum: variantValues },
    title: { type: String, trim: true },
    subtitle: { type: String },
    description: { type: String },
    isVisible: { type: Boolean, default: true },
    anchorId: { type: String },
    theme: { type: String },
    background: { type: String, trim: true, maxlength: 300 },
    padding: { type: String, enum: spacingValues },
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
    cardVariant: { type: String },
  },
  { _id: false, id: false, strict: 'throw' },
);

export const heroBlockSchema = new mongoose.Schema(
  {
    backgroundMedia: { type: mediaRefSchema },
    overlayStyle: { type: String },
    items: { type: [heroItemSchema], default: [] },
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
