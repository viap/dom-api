import { BadRequestException } from '@nestjs/common';
import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { BlockButtonType } from '../enums/block-button-type.enum';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { PageBlockType } from '../enums/page-block-type.enum';
import { RelatedPeopleDisplay } from '../enums/related-people-display.enum';
import {
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
  }> = [],
  refs: ValidationRefs,
): void {
  for (const button of buttons || []) {
    switch (button.type) {
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
): void {
  if (block.media) {
    refs.mediaIds.add(block.media.mediaId);
  }

  collectButtonRefs(block.buttons, refs);

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

function validateHeroBlock(block: HeroBlock, refs: ValidationRefs): void {
  if (block.backgroundMedia) {
    refs.mediaIds.add(block.backgroundMedia.mediaId);
  }

  for (const item of block.items || []) {
    if (item.button) {
      collectButtonRefs([item.button], refs);
    }
  }
}

function validateCtaBlock(block: CtaBlock, refs: ValidationRefs): void {
  ensureBlockHasItems(
    block.buttons,
    'cta.buttons must contain at least one button',
  );
  collectButtonRefs(block.buttons, refs);
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

    switch (block.type) {
      case PageBlockType.RichText:
        validateRichTextBlock(block, refs);
        break;
      case PageBlockType.EntityCollection:
        validateEntityCollectionBlock(block, refs);
        break;
      case PageBlockType.Hero:
        validateHeroBlock(block, refs);
        break;
      case PageBlockType.Cta:
        validateCtaBlock(block, refs);
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

  await validateCollectedRefs(refs, services);
}

export async function prepareBlocksForWrite(
  blocks: PageBlock[],
  services: BlockValidationServices,
): Promise<PageBlock[]> {
  await validateBlocks(blocks, services);

  return blocks.map((block) => {
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

    if (block.type !== PageBlockType.RichText) {
      return block;
    }

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
    };
  });
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
    visibleBlocks.map(async (block) => {
      const typedBlock = block as Record<string, unknown>;
      if (typedBlock.type === PageBlockType.RichText) {
        return toPublicRichTextBlock(typedBlock, services);
      }
      if (
        typedBlock.type === PageBlockType.EntityCollection &&
        typedBlock.source === 'dynamic'
      ) {
        return toPublicDynamicEntityCollectionBlock(
          typedBlock,
          services,
          context,
        );
      }
      if (typedBlock.type === PageBlockType.EntityCollection) {
        const publicBlock = { ...typedBlock };
        delete publicBlock.source;
        return publicBlock;
      }
      return typedBlock;
    }),
  );
  return resolvedBlocks.filter(Boolean) as Array<
    PageBlock | Record<string, unknown>
  >;
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
): Promise<Record<string, unknown> | null> {
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
