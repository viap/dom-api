import {
  RandomSelectionCache,
  canonicalFilters,
  publicRandomSelections,
} from './random-selection-cache';
import { toPublicBlocks, PublicBlockServices } from './block-validation';
import { createRandomOrdering } from './entity-collection-ordering';

const bucket = '2026-10-15';
const beginning = Date.parse(bucket + 'T12:00:00Z');

describe('public Random selection cache', () => {
  afterEach(() => jest.restoreAllMocks());
  it('shares misses, copies arrays, caches empty successes and expires in 60 seconds', async () => {
    let now = beginning;
    const cache = new RandomSelectionCache(() => now);
    const load = jest.fn(async (started: () => void) => {
      started();
      return ['a'];
    });
    const [a, b] = await Promise.all([
      cache.resolve('key', bucket, load),
      cache.resolve('key', bucket, load),
    ]);
    expect(load).toHaveBeenCalledTimes(1);
    a.push('mutated');
    expect(b).toEqual(['a']);
    expect(await cache.resolve('key', bucket, load)).toEqual(['a']);
    now += 60_000;
    await cache.resolve('key', bucket, load);
    expect(load).toHaveBeenCalledTimes(2);
    const empty = jest.fn(async () => []);
    await cache.resolve('empty', bucket, empty);
    await cache.resolve('empty', bucket, empty);
    expect(empty).toHaveBeenCalledTimes(1);
  });
  it('expires at midnight and never retains failed or already-expired scans', async () => {
    let now = Date.parse(bucket + 'T23:59:59Z');
    const cache = new RandomSelectionCache(() => now);
    const load = jest.fn(async () => ['a']);
    await cache.resolve('k', bucket, load);
    now += 1000;
    await cache.resolve('k', bucket, load);
    await cache.resolve('k', bucket, load);
    expect(load).toHaveBeenCalledTimes(3);
    const fail = jest.fn(async () => {
      throw new Error('failed');
    });
    await expect(cache.resolve('bad', bucket, fail)).rejects.toThrow('failed');
    await expect(cache.resolve('bad', bucket, fail)).rejects.toThrow('failed');
    expect(fail).toHaveBeenCalledTimes(2);
  });
  it('evicts LRU and limits bytes', async () => {
    const cache = new RandomSelectionCache(() => beginning, 2, 100);
    const load = jest.fn(async () => ['a']);
    await cache.resolve('a', bucket, load);
    await cache.resolve('b', bucket, load);
    await cache.resolve('a', bucket, load);
    await cache.resolve('c', bucket, load);
    await cache.resolve('b', bucket, load);
    expect(load).toHaveBeenCalledTimes(4);
    const oversized = jest.fn(async () => ['x'.repeat(101)]);
    await cache.resolve('huge', bucket, oversized);
    await cache.resolve('huge', bucket, oversized);
    expect(oversized).toHaveBeenCalledTimes(2);
  });
  it('normalizes object keys and filter sets without changing input', () => {
    const filters = {
      roles: ['b', 'a', 'a'],
      temporal: { to: 'z', from: 'a' },
    };
    expect(canonicalFilters(filters)).toEqual({
      roles: ['a', 'b'],
      temporal: { from: 'a', to: 'z' },
    });
    expect(filters.roles).toEqual(['b', 'a', 'a']);
  });
  it('keys public selection by actual policy and preserves Default freshness', async () => {
    const resolver = jest.fn(async () => [{ id: 'a', label: 'A' }]);
    const services: PublicBlockServices = {
      findPublishedPeopleSummariesByIds: async () => [],
      findDynamicPeopleSummaries: resolver,
      findDynamicPartnerSummaries: resolver,
      findDynamicEventSummaries: resolver,
    };
    const cache = new RandomSelectionCache(() => beginning);
    jest
      .spyOn(publicRandomSelections, 'resolve')
      .mockImplementation(cache.resolve.bind(cache));
    const context = {
      now: new Date(beginning),
      owner: { kind: 'page' as const, pageId: 'page' },
    };
    const block = {
      id: 'b',
      type: 'entityCollection',
      entityType: 'people',
      source: 'dynamic',
      items: [],
      filters: { roles: ['a', 'b'] },
      limit: 12,
      itemOrder: 'random',
    };
    const render = (value = block, ctx = context) =>
      toPublicBlocks([value], services, ctx);
    await Promise.all([render(), render()]);
    expect(resolver).toHaveBeenCalledTimes(1);
    await render({ ...block, filters: { roles: ['b', 'a'] } });
    expect(resolver).toHaveBeenCalledTimes(1);
    await render({ ...block, limit: 100 });
    await render({ ...block, filters: { roles: ['c'] } });
    await render(block, { ...context, domainId: 'domain' } as typeof context);
    await render({ ...block, itemOrder: undefined });
    await render({ ...block, itemOrder: undefined });
    expect(resolver).toHaveBeenCalledTimes(6);
  });
  it('rejects missing seed owner/path at the runtime boundary', () => {
    for (const context of [
      { now: new Date(), blockPath: ['b'] },
      { now: new Date(), owner: { kind: 'page', pageId: 'p' } },
    ]) {
      expect(() => createRandomOrdering(context as never, 'people')).toThrow(
        'owner and block path',
      );
    }
  });
});

it('isolates malformed Random arrays and keeps Manual Random stable across moves', async () => {
  const services: PublicBlockServices = {
    findPublishedPeopleSummariesByIds: async () => [],
    findDynamicPeopleSummaries: async () => [],
    findDynamicPartnerSummaries: async () => [],
    findDynamicEventSummaries: async () => [],
  };
  const context = {
    now: new Date(beginning),
    owner: { kind: 'page' as const, pageId: 'page' },
  };
  const manual = {
    id: 'm',
    type: 'entityCollection',
    entityType: 'people',
    items: ['a', 'b', 'a', 'c'],
    itemOrder: 'random',
  };
  const first = await toPublicBlocks([manual], services, context);
  expect(
    await toPublicBlocks(
      [{ ...manual, items: ['c', 'a', 'b', 'a'] }],
      services,
      context,
    ),
  ).toEqual(first);
  expect(
    (first[0] as { items: string[] }).items.filter((id) => id === 'a'),
  ).toHaveLength(2);
  const broken = { ...manual, items: null };
  const custom = { ...manual, entityType: 'custom', customItems: {} };
  const output = await toPublicBlocks(
    [
      broken,
      custom,
      { id: 'g', type: 'group', blocks: [broken, custom] },
      {
        id: 'cta',
        type: 'cta',
        buttons: [
          { type: 'block', block: broken },
          { type: 'block', block: custom },
        ],
      },
      manual,
    ],
    services,
    context,
  );
  expect((output[0] as Record<string, unknown>).items).toEqual([]);
  expect((output[1] as Record<string, unknown>).customItems).toEqual([]);
  expect(
    (output[2] as { blocks: Array<{ items: string[] }> }).blocks[0].items,
  ).toEqual([]);
  expect(output[2]).toMatchObject({
    blocks: [{ items: [] }, { customItems: [] }],
  });
  expect(output[3]).toMatchObject({
    buttons: [{ block: { items: [] } }, { block: { customItems: [] } }],
  });
  expect(output[4]).toEqual(first[0]);
  expect(manual.items).toEqual(['a', 'b', 'a', 'c']);
});
