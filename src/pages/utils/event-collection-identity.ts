import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { PageBlockType } from '../enums/page-block-type.enum';
import {
  BlockButton,
  EntityCollectionBlock,
  DynamicEntityCollectionBlock,
  ManualEntityCollectionBlock,
  PageRootBlock,
  PersistedCollectionIdentity,
} from '../types/page-block.interface';
import { getHeroItemButtons } from './block-buttons';

export function collectionIdentityKey(
  identity: PersistedCollectionIdentity,
): string {
  return JSON.stringify([
    'page',
    identity.owner.pageId.trim().toLowerCase(),
    identity.blockPath.map((segment) => String(segment)),
  ]);
}

export type StoredEventCollection = {
  identity: PersistedCollectionIdentity;
  block: ManualEntityCollectionBlock | DynamicEntityCollectionBlock;
};

function embeddedButtons(block: PageRootBlock): BlockButton[] {
  if (
    block.type === PageBlockType.RichText ||
    block.type === PageBlockType.Cta
  ) {
    return block.buttons || [];
  }
  if (block.type === PageBlockType.Hero) {
    // Public Hero projection removes hidden items before resolving their
    // embedded buttons. Identity discovery must use the same visibility walk
    // or the snapshot will contain an identity the public Page cannot merge.
    return (block.items || [])
      .filter((item) => item.isVisible !== false)
      .flatMap(getHeroItemButtons);
  }
  if (
    block.type === PageBlockType.EntityCollection &&
    block.entityType === EntityCollectionEntityType.Custom
  ) {
    return block.customItems.flatMap((item) =>
      item.button ? [item.button] : [],
    );
  }
  if (block.type === PageBlockType.Html) {
    return (block.snippets || []).map((snippet) => snippet.button);
  }
  return [];
}

export function collectStoredEventCollections(
  pageId: string,
  blocks: PageRootBlock[],
): StoredEventCollection[] {
  const result: StoredEventCollection[] = [];
  const seen = new Set<string>();
  const visit = (
    block: PageRootBlock,
    parentPath: string[],
    visible: boolean,
  ) => {
    if (!visible || block.isVisible === false) return;
    const blockPath = [...parentPath, String(block.id)];
    if (
      block.type === PageBlockType.EntityCollection &&
      block.entityType === EntityCollectionEntityType.Events
    ) {
      const identity: PersistedCollectionIdentity = {
        owner: { kind: 'page', pageId },
        blockPath,
      };
      const key = collectionIdentityKey(identity);
      if (seen.has(key)) {
        throw new ConflictException('AMBIGUOUS_EVENT_COLLECTION_IDENTITY');
      }
      seen.add(key);
      result.push({
        identity,
        block: block as
          | ManualEntityCollectionBlock
          | DynamicEntityCollectionBlock,
      });
    }
    if (block.type === PageBlockType.Group) {
      for (const child of block.blocks || []) visit(child, blockPath, true);
    }
    for (const button of embeddedButtons(block)) {
      if (button.isVisible !== false && button.block) {
        visit(button.block, blockPath, true);
      }
    }
  };
  for (const block of blocks) visit(block, [], true);
  return result;
}

export function assertUniqueEventCollectionIdentities(
  pageId: string,
  blocks: PageRootBlock[],
): void {
  try {
    collectStoredEventCollections(pageId, blocks);
  } catch (error) {
    if (error instanceof ConflictException) {
      throw new BadRequestException('Duplicate Event collection identity');
    }
    throw error;
  }
}
