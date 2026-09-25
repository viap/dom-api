import { BadRequestException } from '@nestjs/common';
import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { BlockButtonType } from '../enums/block-button-type.enum';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { PageBlockType } from '../enums/page-block-type.enum';
import { RelatedPeopleDisplay } from '../enums/related-people-display.enum';
import {
  BlockButton,
  CtaBlock,
  DynamicEntityCollectionBlock,
  DynamicEntityCollectionResolutionContext,
  EntityCollectionBlock,
  GalleryBlock,
  HeroBlock,
  PageBlock,
  RichTextBlock,
} from '../types/page-block.interface';
import { EventEntityCollectionFilters } from '@/events/types/entity-collection-filters.interface';
import { PartnerEntityCollectionFilters } from '@/partners/types/entity-collection-filters.interface';
import { PeopleEntityCollectionFilters } from '@/people/types/entity-collection-filters.interface';
import {
  sanitizeHtmlBlockContent,
  sanitizeRichTextHtml,
} from './html-sanitizer';

export type ValidationRefs = {
  peopleIds: Set<string>;
  partnerIds: Set<string>;
  eventIds: Set<string>;
  mediaIds: Set<string>;
  pageIds: Set<string>;
  domainIds: Set<string>;
};

export interface BlockValidationServices {
  peopleExistingIds: (ids: string[]) => Promise<Set<string>>;
  partnersExistingIds: (ids: string[]) => Promise<Set<string>>;
  eventsExistingIds: (ids: string[]) => Promise<Set<string>>;
  mediaExistingPublishedIds: (ids: string[]) => Promise<Set<string>>;
  pagesExistingIds: (ids: string[]) => Promise<Set<string>>;
  domainsGetActiveById: (id: string) => Promise<unknown>;
}

export interface PublicBlockServices {
  findPublishedPeopleSummariesByIds: (
    ids: string[],
  ) => Promise<Array<{ _id: string; fullName: string }>>;
  findDynamicPeopleSummaries: (
    filters: PeopleEntityCollectionFilters,
    limit: number,
  ) => Promise<Array<{ id: string; label: string }>>;
  findDynamicPartnerSummaries: (
    filters: PartnerEntityCollectionFilters,
    limit: number,
  ) => Promise<Array<{ id: string; label: string }>>;
  findDynamicEventSummaries: (
    filters: EventEntityCollectionFilters,
    limit: number,
    context: DynamicEntityCollectionResolutionContext,
  ) => Promise<Array<{ id: string; label: string }>>;
}

function createValidationRefs(): ValidationRefs {
  return {
    peopleIds: new Set<string>(),
    partnerIds: new Set<string>(),
    eventIds: new Set<string>(),
    mediaIds: new Set<string>(),
    pageIds: new Set<string>(),
    domainIds: new Set<string>(),
  };
}

function collectIds(target: Set<string>, ids: string[]): void {
  for (const id of ids) {
    target.add(id);
  }
}

function ensureBlockHasItems(
  items: unknown[] | undefined,
  message: string,
): asserts items is unknown[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestException(message);
  }
}

function validateApplicationFormType(value: string): void {
  if (
    !Object.values(ApplicationFormType).includes(value as ApplicationFormType)
  ) {
    throw new BadRequestException(
      `Unsupported application form type: ${value}`,
    );
  }
}

function collectButtonRefs(
  buttons: Array<{
    type: BlockButtonType;
    targetId?: string;
    url?: string;
    block?: PageBlock;
  }> = [],
  refs: ValidationRefs,
  depth: number,
): void {
  for (const button of buttons || []) {
    switch (button.type) {
      case BlockButtonType.Block:
        if (!button.block) {
          throw new BadRequestException(
            'Block button requires an embedded block',
          );
        }
        // Defense-in-depth: Joi already caps nesting at depth 1 before this
        // runs, so stop descending past the cap rather than recurse unbounded.
        if (depth < MAX_EMBEDDED_BLOCK_DEPTH) {
          validateOneBlock(button.block, refs, depth + 1);
        }
        break;
      case BlockButtonType.External:
        if (!button.url) {
          throw new BadRequestException('External button url is required');
        }
        if (button.targetId) {
          throw new BadRequestException(
            'External buttons must not include targetId',
          );
        }
        break;
      case BlockButtonType.Page:
        if (!button.targetId) {
          throw new BadRequestException('Page button target is required');
        }
        if (button.url) {
          throw new BadRequestException('Page buttons must not include url');
        }
        refs.pageIds.add(button.targetId);
        break;
      case BlockButtonType.Domain:
        if (!button.targetId) {
          throw new BadRequestException('Domain button target is required');
        }
        if (button.url) {
          throw new BadRequestException('Domain buttons must not include url');
        }
        refs.domainIds.add(button.targetId);
        break;
      case BlockButtonType.Application:
        if (!button.targetId) {
          throw new BadRequestException(
            'Application button target is required',
          );
        }
        if (button.url) {
          throw new BadRequestException(
            'Application buttons must not include url',
          );
        }
        validateApplicationFormType(button.targetId);
        break;
      default:
        throw new BadRequestException(
          `Unsupported button type: ${button.type}`,
        );
    }
  }
}

function validateRichTextBlock(
  block: RichTextBlock,
  refs: ValidationRefs,
  depth: number,
): void {
  if (block.media) {
    refs.mediaIds.add(block.media.mediaId);
  }

  collectButtonRefs(block.buttons, refs, depth);

  if (block.relatedPeople) {
    if (!block.relatedPeople.title) {
      throw new BadRequestException('relatedPeople.title is required');
    }
    if (!block.relatedPeople.peopleIds.length) {
      throw new BadRequestException(
        'relatedPeople.peopleIds must contain at least one person',
      );
    }
    collectIds(refs.peopleIds, block.relatedPeople.peopleIds);
  }
}

function validateEntityCollectionBlock(
  block: EntityCollectionBlock,
  refs: ValidationRefs,
): void {
  if (block.source === 'dynamic') {
    if (block.items.length !== 0) {
      throw new BadRequestException(
        'Dynamic entity collections must have an empty items array',
      );
    }
    return;
  }

  ensureBlockHasItems(
    block.items,
    'entityCollection.items must contain at least one item',
  );

  switch (block.entityType) {
    case EntityCollectionEntityType.People:
      collectIds(refs.peopleIds, block.items);
      break;
    case EntityCollectionEntityType.Partners:
      collectIds(refs.partnerIds, block.items);
      break;
    case EntityCollectionEntityType.Events:
      collectIds(refs.eventIds, block.items);
      break;
    default:
      throw new BadRequestException(
        `Unsupported entity collection type: ${block.entityType}`,
      );
  }
}

function validateHeroBlock(
  block: HeroBlock,
  refs: ValidationRefs,
  depth: number,
): void {
  if (block.backgroundMedia) {
    refs.mediaIds.add(block.backgroundMedia.mediaId);
  }

  for (const item of block.items || []) {
    if (item.button) {
      collectButtonRefs([item.button], refs, depth);
    }
  }
}

function validateCtaBlock(
  block: CtaBlock,
  refs: ValidationRefs,
  depth: number,
): void {
  ensureBlockHasItems(
    block.buttons,
    'cta.buttons must contain at least one button',
  );
  collectButtonRefs(block.buttons, refs, depth);
}

function validateGalleryBlock(block: GalleryBlock, refs: ValidationRefs): void {
  ensureBlockHasItems(
    block.items,
    'gallery.items must contain at least one item',
  );

  for (const item of block.items) {
    refs.mediaIds.add(item.mediaId);
  }
}

function validateOneBlock(
  block: PageBlock,
  refs: ValidationRefs,
  depth: number,
): void {
  switch (block.type) {
    case PageBlockType.RichText:
      validateRichTextBlock(block, refs, depth);
      break;
    case PageBlockType.EntityCollection:
      validateEntityCollectionBlock(block, refs);
      break;
    case PageBlockType.Hero:
      validateHeroBlock(block, refs, depth);
      break;
    case PageBlockType.Cta:
      validateCtaBlock(block, refs, depth);
      break;
    case PageBlockType.Gallery:
      validateGalleryBlock(block, refs);
      break;
    case PageBlockType.ApplicationForm:
      validateApplicationFormType(block.applicationType);
      break;
    case PageBlockType.Html:
      break;
    default:
      throw new BadRequestException('Unsupported page block type');
  }
}

async function ensureExistingIds(
  ids: Set<string>,
  resolver: (ids: string[]) => Promise<Set<string>>,
  messagePrefix: string,
): Promise<void> {
  if (!ids.size) {
    return;
  }

  const values = [...ids];
  const existingIds = await resolver(values);
  const missingId = values.find((id) => !existingIds.has(id));
  if (missingId) {
    throw new BadRequestException(`${messagePrefix}${missingId}`);
  }
}

async function validateCollectedRefs(
  refs: ValidationRefs,
  services: BlockValidationServices,
): Promise<void> {
  await Promise.all([
    ensureExistingIds(
      refs.peopleIds,
      (ids) => services.peopleExistingIds(ids),
      'Referenced person not found: ',
    ),
    ensureExistingIds(
      refs.partnerIds,
      (ids) => services.partnersExistingIds(ids),
      'Referenced partner not found: ',
    ),
    ensureExistingIds(
      refs.eventIds,
      (ids) => services.eventsExistingIds(ids),
      'Referenced event not found: ',
    ),
    ensureExistingIds(
      refs.mediaIds,
      (ids) => services.mediaExistingPublishedIds(ids),
      'Referenced published media not found: ',
    ),
    ensureExistingIds(
      refs.pageIds,
      (ids) => services.pagesExistingIds(ids),
      'Referenced page button target not found: ',
    ),
    Promise.all(
      [...refs.domainIds].map((id) => services.domainsGetActiveById(id)),
    ),
  ]);
}

async function validateBlocks(
  blocks: PageBlock[],
  services: BlockValidationServices,
): Promise<void> {
  const seenIds = new Set<string>();
  const refs = createValidationRefs();

  for (const block of blocks) {
    if (seenIds.has(block.id)) {
      throw new BadRequestException(
        `Duplicate block id found in payload: ${block.id}`,
      );
    }
    seenIds.add(block.id);

    validateOneBlock(block, refs, 0);
  }

  await validateCollectedRefs(refs, services);
}

function sanitizeEmbeddedButtonBlocks(
  buttons: BlockButton[],
  depth: number,
): BlockButton[] {
  return buttons.map((button) => {
    if (!button.block) {
      return button;
    }
    // Defense-in-depth: Joi caps nesting at depth 1 before this runs; past the
    // cap drop the embedded block rather than recurse on malformed data.
    if (depth >= MAX_EMBEDDED_BLOCK_DEPTH) {
      const rest = { ...button };
      delete rest.block;
      return rest;
    }
    return { ...button, block: sanitizeOneBlock(button.block, depth + 1) };
  });
}

function sanitizeOneBlock(block: PageBlock, depth: number): PageBlock {
  if (block.type === PageBlockType.Html) {
    const sanitizedContent = sanitizeHtmlBlockContent(block.content);
    if (!sanitizedContent) {
      throw new BadRequestException(
        `HTML block "${block.id}" content is empty after sanitization`,
      );
    }
    return {
      ...block,
      content: sanitizedContent,
    };
  }

  if (
    block.type === PageBlockType.EntityCollection &&
    block.source === 'dynamic'
  ) {
    return normalizeDynamicEntityCollectionBlock(block);
  }

  if (block.type === PageBlockType.RichText) {
    return {
      ...block,
      description:
        typeof block.description === 'string'
          ? sanitizeRichTextHtml(block.description)
          : block.description,
      relatedPeople: block.relatedPeople
        ? {
            ...block.relatedPeople,
            display: block.relatedPeople.display || RelatedPeopleDisplay.Inline,
          }
        : undefined,
      buttons: block.buttons
        ? sanitizeEmbeddedButtonBlocks(block.buttons, depth)
        : block.buttons,
    };
  }

  if (block.type === PageBlockType.Cta) {
    return {
      ...block,
      buttons: sanitizeEmbeddedButtonBlocks(block.buttons, depth),
    };
  }

  if (block.type === PageBlockType.Hero) {
    return {
      ...block,
      items: block.items?.map((item) => {
        if (!item.button?.block) {
          return item;
        }
        if (depth >= MAX_EMBEDDED_BLOCK_DEPTH) {
          const restButton = { ...item.button };
          delete restButton.block;
          return { ...item, button: restButton };
        }
        return {
          ...item,
          button: {
            ...item.button,
            block: sanitizeOneBlock(item.button.block, depth + 1),
          },
        };
      }),
    };
  }

  return block;
}

export async function prepareBlocksForWrite(
  blocks: PageBlock[],
  services: BlockValidationServices,
): Promise<PageBlock[]> {
  await validateBlocks(blocks, services);

  return blocks.map((block) => sanitizeOneBlock(block, 0));
}

function normalizeDynamicEntityCollectionBlock(
  block: DynamicEntityCollectionBlock,
): DynamicEntityCollectionBlock {
  const filters = Object.fromEntries(
    Object.entries(block.filters).flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        const normalized = value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter(Boolean);
        return normalized.length ? [[key, normalized]] : [];
      }
      return value === undefined ? [] : [[key, value]];
    }),
  );

  return {
    ...block,
    items: [],
    filters: filters as DynamicEntityCollectionBlock['filters'],
    limit: block.limit ?? 12,
  };
}

// Embedded blocks live at depth 1 by construction — Joi rejects deeper nesting
// on write (restricted embedded buttons carry no block). But `button.block` is
// stored as Mixed, so a doc that bypassed Joi (migration, restore, manual edit)
// could nest arbitrarily; this caps the recursion on the public read path.
// Keep in sync with dom-web MAX_EMBEDDED_BLOCK_DEPTH (pageBlockReferences.ts).
const MAX_EMBEDDED_BLOCK_DEPTH = 1;

export async function toPublicBlocks(
  blocks: Array<PageBlock | Record<string, unknown>>,
  services: PublicBlockServices,
  context: DynamicEntityCollectionResolutionContext,
): Promise<Array<PageBlock | Record<string, unknown>>> {
  const visibleBlocks = blocks.filter((block) => {
    if (!block || typeof block !== 'object') {
      return false;
    }
    const typedBlock = block as Record<string, unknown>;
    return typedBlock.isVisible !== false;
  });
  const resolvedBlocks = await Promise.all(
    visibleBlocks.map((block) => toPublicOneBlock(block, services, context, 0)),
  );
  return resolvedBlocks.filter(Boolean) as Array<
    PageBlock | Record<string, unknown>
  >;
}

async function withPublicButtonBlocks(
  block: Record<string, unknown>,
  services: PublicBlockServices,
  context: DynamicEntityCollectionResolutionContext,
  depth: number,
): Promise<Record<string, unknown>> {
  const buttons = block.buttons;
  if (!Array.isArray(buttons)) {
    return block;
  }
  const resolved = await Promise.all(
    buttons.map(async (button) => {
      const embedded =
        button && typeof button === 'object'
          ? (button as Record<string, unknown>).block
          : undefined;
      if (!embedded) {
        return button;
      }
      if (depth >= MAX_EMBEDDED_BLOCK_DEPTH) {
        // Beyond the depth-1 write invariant — malformed stored data. Drop the
        // embedded block instead of recursing (resource-exhaustion guard).
        const rest = { ...(button as Record<string, unknown>) };
        delete rest.block;
        return rest;
      }
      return {
        ...(button as Record<string, unknown>),
        block: await toPublicOneBlock(
          embedded as Record<string, unknown>,
          services,
          context,
          depth + 1,
        ),
      };
    }),
  );
  return { ...block, buttons: resolved };
}

async function withPublicHeroButtonBlocks(
  block: Record<string, unknown>,
  services: PublicBlockServices,
  context: DynamicEntityCollectionResolutionContext,
  depth: number,
): Promise<Record<string, unknown>> {
  const items = block.items;
  if (!Array.isArray(items)) {
    return block;
  }
  const resolved = await Promise.all(
    items.map(async (item) => {
      const button =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>).button
          : undefined;
      const embedded =
        button && typeof button === 'object'
          ? (button as Record<string, unknown>).block
          : undefined;
      if (!embedded) {
        return item;
      }
      if (depth >= MAX_EMBEDDED_BLOCK_DEPTH) {
        const nextButton = { ...(button as Record<string, unknown>) };
        delete nextButton.block;
        return { ...(item as Record<string, unknown>), button: nextButton };
      }
      return {
        ...(item as Record<string, unknown>),
        button: {
          ...(button as Record<string, unknown>),
          block: await toPublicOneBlock(
            embedded as Record<string, unknown>,
            services,
            context,
            depth + 1,
          ),
        },
      };
    }),
  );
  return { ...block, items: resolved };
}

async function toPublicOneBlock(
  block: PageBlock | Record<string, unknown>,
  services: PublicBlockServices,
  context: DynamicEntityCollectionResolutionContext,
  depth: number,
): Promise<Record<string, unknown>> {
  const typedBlock = block as Record<string, unknown>;
  if (typedBlock.type === PageBlockType.RichText) {
    const publicBlock = await toPublicRichTextBlock(typedBlock, services);
    return withPublicButtonBlocks(publicBlock, services, context, depth);
  }
  if (
    typedBlock.type === PageBlockType.EntityCollection &&
    typedBlock.source === 'dynamic'
  ) {
    return toPublicDynamicEntityCollectionBlock(typedBlock, services, context);
  }
  if (typedBlock.type === PageBlockType.EntityCollection) {
    const publicBlock = { ...typedBlock };
    delete publicBlock.source;
    return publicBlock;
  }
  if (typedBlock.type === PageBlockType.Cta) {
    return withPublicButtonBlocks(typedBlock, services, context, depth);
  }
  if (typedBlock.type === PageBlockType.Hero) {
    return withPublicHeroButtonBlocks(typedBlock, services, context, depth);
  }
  return typedBlock;
}

async function toPublicDynamicEntityCollectionBlock(
  block: Record<string, unknown>,
  services: PublicBlockServices,
  context: DynamicEntityCollectionResolutionContext,
): Promise<Record<string, unknown>> {
  const entityType = block.entityType as EntityCollectionEntityType;
  const filters = (block.filters ||
    {}) as DynamicEntityCollectionBlock['filters'];
  const limit = typeof block.limit === 'number' ? block.limit : 12;
  let summaries: Array<{ id: string; label: string }>;

  switch (entityType) {
    case EntityCollectionEntityType.People:
      summaries = await services.findDynamicPeopleSummaries(
        filters as PeopleEntityCollectionFilters,
        limit,
      );
      break;
    case EntityCollectionEntityType.Partners:
      summaries = await services.findDynamicPartnerSummaries(
        filters as PartnerEntityCollectionFilters,
        limit,
      );
      break;
    case EntityCollectionEntityType.Events:
      summaries = await services.findDynamicEventSummaries(
        filters as EventEntityCollectionFilters,
        limit,
        context,
      );
      break;
    default:
      throw new BadRequestException(
        `Unsupported entity collection type: ${entityType}`,
      );
  }

  const publicBlock = { ...block };
  delete publicBlock.source;
  delete publicBlock.filters;
  delete publicBlock.limit;
  return { ...publicBlock, items: summaries.map((summary) => summary.id) };
}

async function toPublicRichTextBlock(
  block: Record<string, unknown>,
  services: PublicBlockServices,
): Promise<Record<string, unknown>> {
  const relatedPeople =
    block.relatedPeople && typeof block.relatedPeople === 'object'
      ? (block.relatedPeople as Record<string, unknown>)
      : null;

  if (!relatedPeople) {
    return block;
  }

  const peopleIds = Array.isArray(relatedPeople.peopleIds)
    ? relatedPeople.peopleIds.filter(
        (value): value is string => typeof value === 'string',
      )
    : [];

  const summaries = await services.findPublishedPeopleSummariesByIds(peopleIds);
  const peopleById = new Map(
    summaries.map((person) => [person._id.toString(), person]),
  );
  const people = peopleIds
    .map((personId) => peopleById.get(personId))
    .filter(
      (
        person,
      ): person is {
        _id: string;
        fullName: string;
      } => Boolean(person),
    );
  const visiblePeopleIds = people.map((person) => person._id);

  if (!people.length) {
    const rest = { ...block };
    delete rest.relatedPeople;
    return rest;
  }

  return {
    ...block,
    relatedPeople: {
      ...relatedPeople,
      peopleIds: visiblePeopleIds,
      people,
    },
  };
}
