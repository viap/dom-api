import { createHash } from 'node:crypto';
import type { RandomOrdering } from '@/common/utils/ranked-query';
import type { DynamicEntityCollectionResolutionContext } from '@/pages/types/page-block.interface';

type SeedContext = Omit<
  DynamicEntityCollectionResolutionContext,
  'blockPath'
> & { blockPath: string[] };

export function orderBucket(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function encodeOrderSeed(
  context: SeedContext,
  entityType: string,
): string {
  const owner = context.owner;
  if (!owner || !context.blockPath?.length) {
    throw new Error('Random ordering requires owner and block path');
  }
  const identifier =
    owner.kind === 'page'
      ? owner.pageId.toLowerCase()
      : owner.kind === 'event'
      ? owner.eventId.toLowerCase()
      : owner.draftToken;
  return JSON.stringify([
    orderBucket(context.now),
    owner.kind,
    identifier,
    context.blockPath,
    entityType,
    context.domainId?.toLowerCase() ?? null,
  ]);
}

export function createRandomOrdering(
  context: SeedContext,
  entityType: string,
): RandomOrdering {
  return {
    seed: createHash('sha256')
      .update(encodeOrderSeed(context, entityType))
      .digest('hex'),
  };
}
