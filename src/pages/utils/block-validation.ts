import { BadRequestException } from '@nestjs/common';
import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { BlockButtonType } from '../enums/block-button-type.enum';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { PageBlockType } from '../enums/page-block-type.enum';
import { RelatedPeopleDisplay } from '../enums/related-people-display.enum';
import {
  CtaBlock,
  EntityCollectionBlock,
  GalleryBlock,
  HeroBlock,
  PageBlock,
  RichTextBlock,
} from '../types/page-block.interface';
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

export async function toPublicBlocks(
  blocks: Array<PageBlock | Record<string, unknown>>,
  services: PublicBlockServices,
): Promise<Array<PageBlock | Record<string, unknown>>> {
  const publicBlocks: Array<PageBlock | Record<string, unknown>> = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') {
      continue;
    }

    const typedBlock = block as Record<string, unknown>;
    if (typedBlock.isVisible === false) {
      continue;
    }

    if (typedBlock.type === PageBlockType.RichText) {
      const processedBlock = await toPublicRichTextBlock(typedBlock, services);
      if (processedBlock) {
        publicBlocks.push(processedBlock);
      }
      continue;
    }

    publicBlocks.push(typedBlock);
  }

  return publicBlocks;
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
    const { relatedPeople: _relatedPeople, ...rest } = block;
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
