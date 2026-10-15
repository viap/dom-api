import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPageSchema } from '@/pages/schemas/joi.create-page.schema';
import {
  pageBlocksSchema,
  pageBlockSchema,
} from '@/pages/schemas/joi.page-block.schema';
import { entityCollectionPreviewSchema } from '@/pages/schemas/joi.entity-collection-preview.schema';
import { toPublicBlocks } from './block-validation';
const fixture = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../../scripts/fixtures/entity-collection-ordering-compatibility.json',
    ),
    'utf8',
  ),
);

it('keeps maintained compatibility fixtures valid and strips policy from public output', async () => {
  expect(createPageSchema.validate(fixture.page).error).toBeUndefined();
  expect(pageBlocksSchema.validate(fixture.eventBlocks).error).toBeUndefined();
  for (const block of fixture.dynamicLimitVariants)
    expect(pageBlockSchema.validate(block).error).toBeUndefined();
  const ids = ['507f1f77bcf86cd799439221'];
  const resolve = async (_filters: unknown, limit: number) =>
    Array.from({ length: limit }, () => ({ id: ids[0], label: 'Person' }));
  const result = await toPublicBlocks(
    [
      ...fixture.page.blocks,
      ...fixture.eventBlocks,
      ...fixture.dynamicLimitVariants,
    ],
    {
      findPublishedPeopleSummariesByIds: async () => [],
      findDynamicPeopleSummaries: resolve,
      findDynamicPartnerSummaries: resolve,
      findDynamicEventSummaries: resolve,
    },
    {
      owner: { kind: 'page', pageId: ids[0] },
      now: new Date('2026-10-15T00:00:00Z'),
    },
  );
  expect(JSON.stringify(result)).not.toContain('itemOrder');
  expect(
    result
      .slice(-3)
      .map((block) => (block as { items: string[] }).items.length),
  ).toEqual([24, 25, 100]);
});
it('accepts canonical/legacy preview identity and opaque drafts, checking legacy blockId only when supplied', () => {
  const request = {
    entityType: 'people',
    filters: {},
    contextDomainId: null,
    itemOrder: 'random',
    blockPath: ['parent', 'child'],
    owner: { kind: 'page', pageId: '507f1f77bcf86cd799439221' },
  };
  for (const kind of ['page', 'persistedPage']) {
    const result = entityCollectionPreviewSchema.validate({
      ...request,
      owner: { ...request.owner, kind },
    });
    expect(result.error).toBeUndefined();
    expect(result.value.owner.kind).toBe('page');
  }
  expect(
    entityCollectionPreviewSchema.validate({ ...request, blockId: 'child' })
      .error,
  ).toBeUndefined();
  expect(
    entityCollectionPreviewSchema.validate({ ...request, blockId: 'wrong' })
      .error,
  ).toBeDefined();
  expect(
    entityCollectionPreviewSchema.validate({
      ...request,
      owner: { kind: 'draftPage', draftToken: 'draft-opaque-token' },
    }).error,
  ).toBeUndefined();
});

it('exercises itemOrder and the limit increase as independent stored-data changes', () => {
  for (const block of fixture.dynamicLimitVariants) {
    const { itemOrder, ...withoutOrder } = block;
    expect(itemOrder).toBe('random');
    expect(pageBlockSchema.validate(withoutOrder).error).toBeUndefined();
    expect(
      pageBlockSchema.validate({ ...block, limit: 24 }).error,
    ).toBeUndefined();
    const downgraded = {
      ...withoutOrder,
      limit: Math.min(withoutOrder.limit, 24),
    };
    expect(downgraded).not.toHaveProperty('itemOrder');
    expect(downgraded.limit).toBe(24);
    expect(pageBlockSchema.validate(downgraded).error).toBeUndefined();
    // Current-schema checks only: an actual previous release must validate these separately.
    expect(block.itemOrder).toBe('random');
  }
  expect(
    fixture.dynamicLimitVariants.map((block: { limit: number }) => block.limit),
  ).toEqual([24, 25, 100]);
});
