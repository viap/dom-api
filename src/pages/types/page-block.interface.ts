import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { BlockButtonType } from '../enums/block-button-type.enum';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { EntityCollectionLayout } from '../enums/entity-collection-layout.enum';
import { PageBlockType } from '../enums/page-block-type.enum';
import { RelatedPeopleDisplay } from '../enums/related-people-display.enum';

export type BlockSpacing = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type BlockVariant = 'section' | 'block' | 'element';
export type MediaPosition = 'left' | 'right' | 'top' | 'bottom';

export interface BlockButton {
  label: string;
  type: BlockButtonType;
  targetId?: string;
  url?: string;
  openInNewTab?: boolean;
  style?: 'primary' | 'secondary' | 'ghost' | 'link';
}

export interface MediaRef {
  mediaId: string;
  alt?: string;
  caption?: string;
}

export interface RelatedPeopleGroup {
  title: string;
  peopleIds: string[];
  display?: RelatedPeopleDisplay;
}

export interface PageBlockBase {
  id: string;
  type: PageBlockType;
  variant?: BlockVariant;
  title?: string;
  subtitle?: string;
  description?: string;
  isVisible?: boolean;
  anchorId?: string;
  theme?: string;
  paddingTop?: BlockSpacing;
  paddingBottom?: BlockSpacing;
}

export interface RichTextBlock extends PageBlockBase {
  type: PageBlockType.RichText;
  media?: MediaRef;
  mediaPosition?: MediaPosition;
  buttons?: BlockButton[];
  relatedPeople?: RelatedPeopleGroup;
}

export interface EntityCollectionBlock extends PageBlockBase {
  type: PageBlockType.EntityCollection;
  entityType: EntityCollectionEntityType;
  layout: EntityCollectionLayout;
  items: string[];
  cardVariant?: string;
}

export interface HeroBlockItem {
  icon?: string;
  title: string;
  subtitle?: string;
  button?: BlockButton;
}

export interface HeroBlock extends PageBlockBase {
  type: PageBlockType.Hero;
  backgroundMedia?: MediaRef;
  overlayStyle?: string;
  items?: HeroBlockItem[];
}

export interface CtaBlock extends PageBlockBase {
  type: PageBlockType.Cta;
  backgroundStyle?: string;
  buttons: BlockButton[];
}

export interface GalleryBlockItem {
  mediaId: string;
  title?: string;
  subtitle?: string;
}

export interface GalleryBlock extends PageBlockBase {
  type: PageBlockType.Gallery;
  layout?: 'grid' | 'masonry' | 'slider';
  items: GalleryBlockItem[];
}

export interface ApplicationFormBlock extends PageBlockBase {
  type: PageBlockType.ApplicationForm;
  applicationType: ApplicationFormType;
  successMessage?: string;
  buttonLabel?: string;
}

export type PageBlock =
  | RichTextBlock
  | EntityCollectionBlock
  | HeroBlock
  | CtaBlock
  | GalleryBlock
  | ApplicationFormBlock;
