export enum PageBlockType {
  RichText = 'richText',
  EntityCollection = 'entityCollection',
  Hero = 'hero',
  Cta = 'cta',
  Gallery = 'gallery',
  ApplicationForm = 'applicationForm',
  Html = 'html',
  Group = 'group',
}

// The block types allowed inside a Group (all non-Group types except Hero, §7).
export type GroupChildBlockType =
  | PageBlockType.RichText
  | PageBlockType.EntityCollection
  | PageBlockType.Cta
  | PageBlockType.Gallery
  | PageBlockType.ApplicationForm
  | PageBlockType.Html;

// Single source of truth for the eligible child types. Consumed by the Mongoose
// child-discriminator registration; keep the Joi child union and dom-web picker
// in sync with it.
export const GROUP_CHILD_BLOCK_TYPES: GroupChildBlockType[] = [
  PageBlockType.RichText,
  PageBlockType.EntityCollection,
  PageBlockType.Cta,
  PageBlockType.Gallery,
  PageBlockType.ApplicationForm,
  PageBlockType.Html,
];
