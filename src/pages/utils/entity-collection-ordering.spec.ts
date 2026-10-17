import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import {
  permuteItems,
  RankedTopK,
  ScanSemaphore,
  processRandomScans,
  selectRandomDocuments,
} from '@/common/utils/ranked-query';
import { pageSchema } from '@/pages/schemas/page.schema';
import { domainEventSchema } from '@/events/schemas/domain-event.schema';
import {
  createRandomOrdering,
  encodeOrderSeed,
  orderBucket,
} from './entity-collection-ordering';
import {
  DynamicEntityCollectionResolutionContext,
  PageRootBlock,
  EntityCollectionBlock,
} from '@/pages/types/page-block.interface';
import { pageBlockSchema } from '@/pages/schemas/joi.page-block.schema';
import { entityCollectionPreviewSchema } from '@/pages/schemas/joi.entity-collection-preview.schema';
import {
  prepareBlocksForWrite,
  toPublicBlocks,
  PublicBlockServices,
  BlockValidationServices,
} from './block-validation';

const id = '507f1f77bcf86cd799439221';
const context: DynamicEntityCollectionResolutionContext & {
  blockPath: string[];
  owner: { kind: 'page'; pageId: string };
} = {
  now: new Date('2026-10-15T23:59:59Z'),
  owner: { kind: 'page', pageId: id },
  blockPath: ['a', 'b'],
};
const manual = {
  id: 'collection',
  type: 'entityCollection',
  entityType: 'people',
  layout: 'grid',
  items: [id, id],
};
const dynamic = {
  ...manual,
  source: 'dynamic',
  items: [],
  filters: {},
  limit: 2,
};
const custom = {
  ...manual,
  entityType: 'custom',
  items: [],
  customItems: [{ title: 'A' }, { title: 'B' }],
};
const services: PublicBlockServices = {
  findPublishedPeopleSummariesByIds: async () => [],
  findDynamicPeopleSummaries: async () => [],
  findDynamicPartnerSummaries: async () => [],
  findDynamicEventSummaries: async () => [],
};
const existing = async (ids: string[]) => new Set(ids);
const validation: BlockValidationServices = {
  peopleExistingIds: existing,
  partnersExistingIds: existing,
  eventsExistingIds: existing,
  mediaExistingPublishedIds: existing,
  pagesExistingIds: existing,
  domainsGetActiveById: async () => ({}),
};

describe('EntityCollection ordering contract', () => {
  it('Mongoose retains Random in root, Group, Event, and every embedded container', () => {
    const PageModel = mongoose.model('OrderingPageSchemaTest', pageSchema);
    const EventModel = mongoose.model(
      'OrderingEventSchemaTest',
      domainEventSchema,
    );
    const random = { ...dynamic, itemOrder: 'random' };
    const button = { type: 'block', label: 'Open', block: random };
    const blocks = [
      random,
      { id: 'text', type: 'richText', buttons: [button] },
      { id: 'cta', type: 'cta', buttons: [button] },
      { id: 'hero', type: 'hero', items: [{ title: 'Hero', button }] },
      { ...custom, id: 'custom', customItems: [{ title: 'Custom', button }] },
      {
        id: 'html',
        type: 'html',
        template: 'vertical',
        content: '<div data-dom-snippet="snippet"></div>',
        snippets: [{ id: 'snippet', type: 'button', button }],
      },
    ];
    const page = new PageModel({
      title: 'Test',
      slug: 'test',
      blocks: [...blocks, { id: 'group', type: 'group', blocks: [random] }],
    }).toObject();
    const event = new EventModel({ blocks }).toObject();
    const policies = (value: unknown): string[] => {
      if (!value || typeof value !== 'object') return [];
      const node = value as Record<string, unknown>;
      return [
        ...(node.itemOrder ? [String(node.itemOrder)] : []),
        ...Object.values(node).flatMap(policies),
      ];
    };
    expect(policies(page.blocks)).toEqual(Array(7).fill('random'));
    expect(policies(event.blocks)).toEqual(Array(6).fill('random'));
    const invalid = new PageModel({
      title: 'Test',
      slug: 'test',
      blocks: [{ ...manual, itemOrder: 'invalid' }],
    });
    expect(invalid.validateSync()).toBeDefined();
    mongoose.deleteModel('OrderingPageSchemaTest');
    mongoose.deleteModel('OrderingEventSchemaTest');
  });

  it.each([manual, dynamic, custom])(
    'validates modes and canonically omits Default for $entityType/$source',
    async (block) => {
      for (const itemOrder of [undefined, 'default', 'random']) {
        expect(
          pageBlockSchema.validate({ ...block, itemOrder }).error,
        ).toBeUndefined();
        const [saved] = await prepareBlocksForWrite(
          [{ ...block, itemOrder }] as unknown as PageRootBlock[],
          validation,
        );
        expect((saved as EntityCollectionBlock).itemOrder).toBe(
          itemOrder === 'random' ? 'random' : undefined,
        );
        if (itemOrder !== 'random')
          expect(saved).not.toHaveProperty('itemOrder');
      }
      expect(
        pageBlockSchema.validate({ ...block, itemOrder: 'alphabetical' }).error,
      ).toBeDefined();
    },
  );

  it('requires discriminated identity and matching path for Random preview only', () => {
    const input = { entityType: 'people', filters: {}, contextDomainId: null };
    expect(entityCollectionPreviewSchema.validate(input).error).toBeUndefined();
    const random = {
      ...input,
      itemOrder: 'random',
      blockId: 'b',
      blockPath: ['a', 'b'],
      owner: { kind: 'persistedPage', pageId: id },
    };
    expect(
      entityCollectionPreviewSchema.validate(random).error,
    ).toBeUndefined();
    expect(
      entityCollectionPreviewSchema.validate({
        ...random,
        owner: {
          kind: 'draftPage',
          draftToken: 'a44a9bc6-534f-4eb5-97c1-1de29a5ec294',
        },
      }).error,
    ).toBeUndefined();
    for (const invalid of [
      { ...input, itemOrder: 'random' },
      { ...random, blockPath: ['x'] },
      { ...random, owner: { kind: 'persistedPage', pageId: 'bad' } },
      { ...random, owner: { kind: 'draftPage', pageId: id } },
      { ...random, owner: { ...random.owner, draftToken: 'extraneous' } },
    ])
      expect(
        entityCollectionPreviewSchema.validate(invalid).error,
      ).toBeDefined();
  });

  it('uses canonical JSON tuples, separates owner/path/domain, and rotates at UTC midnight', () => {
    const encoded = encodeOrderSeed(context, 'people');
    expect(encoded).toBe(
      JSON.stringify(['2026-10-15', 'page', id, ['a', 'b'], 'people', null]),
    );
    expect(createRandomOrdering(context, 'people').seed).toBe(
      createHash('sha256').update(encoded).digest('hex'),
    );
    const variants: Array<
      DynamicEntityCollectionResolutionContext & { blockPath: string[] }
    > = [
      { ...context, owner: { kind: 'event', eventId: id } },
      { ...context, owner: { kind: 'page', pageId: 'other' } },
      { ...context, blockPath: ['a,b'] },
      { ...context, blockPath: ['other', 'b'] },
      { ...context, domainId: id },
      { ...context, now: new Date('2026-10-16T00:00:00Z') },
    ];
    for (const variant of variants)
      expect(encodeOrderSeed(variant, 'people')).not.toBe(encoded);
    expect(orderBucket(new Date('2026-10-16T03:59:59+04:00'))).toBe(
      '2026-10-15',
    );
  });

  it('matches a complete sort independent of cursor order and retains K projected documents', async () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      _id: String(index),
      title: `row ${index}`,
    }));
    const seed = createRandomOrdering(context, 'people').seed;
    const expected = permuteItems(rows, seed, (row) => row._id).slice(0, 24);
    const top = new RankedTopK<(typeof rows)[number]>(24, seed);
    for (const row of [...rows].reverse()) top.add(row, row._id);
    expect(top.values()).toEqual(expected);
    const close = jest.fn(async () => undefined);
    const selected = await selectRandomDocuments(
      () => ({
        async *[Symbol.asyncIterator]() {
          yield* rows;
        },
        close,
      }),
      24,
      { seed },
    );
    expect(selected).toEqual(expected);
    expect(selected[0]).toBe(rows.find((row) => row._id === selected[0]._id));
    expect(close).toHaveBeenCalledTimes(1);
    expect(selected.some((row) => Number(row._id) > 24)).toBe(true);
  });

  it('preserves Manual duplicate multiplicity, copies arrays, and keys Custom by authored index', async () => {
    const blocks = [manual, custom].map((block) => ({
      ...block,
      itemOrder: 'random',
    }));
    const before = JSON.stringify(blocks);
    const first = await toPublicBlocks(blocks, services, {
      ...context,
      blockPath: undefined,
    });
    expect(
      await toPublicBlocks(blocks, services, {
        ...context,
        blockPath: undefined,
      }),
    ).toEqual(first);
    expect((first[0] as EntityCollectionBlock).items).toEqual([id, id]);
    expect((first[1] as { customItems: unknown[] }).customItems).toHaveLength(
      2,
    );
    expect(first.every((block) => !('itemOrder' in block))).toBe(true);
    expect(JSON.stringify(blocks)).toBe(before);
    expect((first[0] as EntityCollectionBlock).items).not.toBe(blocks[0].items);
    const seed = createRandomOrdering(context, 'custom').seed;
    const values = Array.from({ length: 20 }, (_, index) => `item-${index}`);
    expect(permuteItems(values, seed, (_, index) => index)).not.toEqual(
      permuteItems([...values].reverse(), seed, (_, index) => index),
    );
  });

  it('uses common process admission across roots, Group and embedded paths, preserving visibility', async () => {
    let active = 0;
    let maximum = 0;
    const seen: Array<{ seed: string }> = [];
    const resolver: PublicBlockServices['findDynamicPeopleSummaries'] = async (
      _,
      limit,
      ctx,
    ) => {
      if (!ctx?.seed) throw new Error('Missing Random seed');
      seen.push(ctx);
      return processRandomScans.run(async () => {
        maximum = Math.max(maximum, ++active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active--;
        return [{ id: String(limit), label: 'selected' }];
      });
    };
    const random = { ...dynamic, id: 'same', itemOrder: 'random' };
    const blocks = [
      random,
      {
        id: 'group',
        type: 'group',
        blocks: [random, { ...random, id: 'hidden', isVisible: false }],
      },
      ...['one', 'two', 'three'].map((parent) => ({
        id: parent,
        type: 'cta',
        buttons: [
          {
            type: 'block',
            label: 'Open',
            block: { ...random, isVisible: false },
          },
        ],
      })),
    ];
    await toPublicBlocks(
      blocks,
      { ...services, findDynamicPeopleSummaries: resolver },
      { ...context, blockPath: undefined },
    );
    expect(maximum).toBe(2);
    expect(seen.map((entry) => entry.seed)).toEqual(
      [
        ['same'],
        ['group', 'same'],
        ['one', 'same'],
        ['two', 'same'],
        ['three', 'same'],
      ].map(
        (blockPath) =>
          createRandomOrdering({ ...context, blockPath }, 'people').seed,
      ),
    );
    expect(new Set(seen.map((entry) => entry.seed)).size).toBe(5);
  });

  it('closes failing cursors and releases the scan slot', async () => {
    const ordering = { seed: 'seed' };
    const budget = new ScanSemaphore(1);
    const close = jest.fn(async () => undefined);
    await expect(
      selectRandomDocuments(
        () => ({
          async *[Symbol.asyncIterator]() {
            yield { _id: 'a' };
            throw new Error('scan failed');
          },
          close,
        }),
        1,
        ordering,
        budget,
      ),
    ).rejects.toThrow('scan failed');
    expect(close).toHaveBeenCalledTimes(1);
    await expect(budget.run(async () => 'released')).resolves.toBe('released');
  });
});

describe('Dynamic EntityCollection 100-item limit', () => {
  it.each(['people', 'partners', 'events'])(
    '%s accepts 100 for Default and Random in saved blocks and preview, and rejects invalid bounds',
    (entityType) => {
      for (const itemOrder of [undefined, 'random']) {
        for (const limit of [1, 24, 25, 100]) {
          expect(
            pageBlockSchema.validate({
              ...dynamic,
              entityType,
              itemOrder,
              limit,
            }).error,
          ).toBeUndefined();
          expect(
            entityCollectionPreviewSchema.validate({
              entityType,
              filters: {},
              limit,
              itemOrder,
              contextDomainId: null,
              blockId: 'collection',
              blockPath: ['collection'],
              owner: { kind: 'persistedPage', pageId: id },
            }).error,
          ).toBeUndefined();
        }
        for (const limit of [0, 101, 1.5]) {
          expect(
            pageBlockSchema.validate({
              ...dynamic,
              entityType,
              itemOrder,
              limit,
            }).error,
          ).toBeDefined();
          expect(
            entityCollectionPreviewSchema.validate({
              entityType,
              filters: {},
              limit,
              itemOrder,
              contextDomainId: null,
              blockId: 'collection',
              blockPath: ['collection'],
              owner: { kind: 'persistedPage', pageId: id },
            }).error,
          ).toBeDefined();
        }
      }
    },
  );

  it.each([undefined, 'random'] as const)(
    'materializes all 100 selected IDs without public truncation (%s)',
    async (itemOrder) => {
      const summaries = Array.from({ length: 100 }, (_, index) => ({
        id: String(index),
        label: String(index),
      }));
      const findDynamicPeopleSummaries = jest.fn(
        async (_filters: unknown, _limit: number) => {
          void _filters;
          void _limit;
          return summaries;
        },
      );
      const result = await toPublicBlocks(
        [{ ...dynamic, limit: 100, itemOrder }],
        {
          ...services,
          findDynamicPeopleSummaries,
        },
        context,
      );
      expect(findDynamicPeopleSummaries.mock.calls[0][1]).toBe(100);
      expect((result[0] as EntityCollectionBlock).items).toEqual(
        summaries.map((row) => row.id),
      );
      expect(result[0]).not.toHaveProperty('limit');
    },
  );
});
