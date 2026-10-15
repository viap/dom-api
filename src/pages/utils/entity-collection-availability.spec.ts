import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  RandomScanUnavailableException,
  RandomScanFailureReason,
  RandomOrdering,
} from '@/common/utils/ranked-query';
import { toPublicBlocks, PublicBlockServices } from './block-validation';
import {
  publicRandomSelections,
  RandomSelectionCache,
} from './random-selection-cache';

const now = new Date('2026-10-15T12:00:00Z');
const context = {
  now,
  domainId: 'domain',
  owner: { kind: 'page' as const, pageId: 'page' },
};
const dynamic = (id: string) => ({
  id,
  type: 'entityCollection',
  entityType: 'people',
  source: 'dynamic',
  itemOrder: 'random',
  filters: { roles: ['team'] },
  limit: 100,
  items: [],
});
function setup() {
  const cache = new RandomSelectionCache(() => now.getTime());
  jest
    .spyOn(publicRandomSelections, 'resolve')
    .mockImplementation(cache.resolve.bind(cache));
  const resolve = jest.fn(
    async (_filters: unknown, _limit: number, ordering?: RandomOrdering) => [
      { id: ordering ? 'random' : 'default', label: 'Selected' },
    ],
  );
  const services: PublicBlockServices = {
    findPublishedPeopleSummariesByIds: async () => [],
    findDynamicPeopleSummaries: resolve,
    findDynamicPartnerSummaries: resolve,
    findDynamicEventSummaries: async (filters, limit, ctx) =>
      resolve(filters, limit, ctx.ordering),
  };
  return { services, resolve, cache };
}
afterEach(() => jest.restoreAllMocks());

it.each<RandomScanFailureReason>([
  'queue_full',
  'queue_timeout',
  'scan_timeout',
  'mongo_timeout',
])(
  'retries only the overloaded block with Default for %s, never caching fallback',
  async (reason) => {
    const { services, resolve } = setup();
    resolve.mockImplementationOnce(async () => {
      throw new RandomScanUnavailableException(reason);
    });
    const block = dynamic('a');
    expect(await toPublicBlocks([block], services, context)).toMatchObject([
      { items: ['default'] },
    ]);
    expect(resolve.mock.calls[0]).toEqual([
      block.filters,
      100,
      { seed: expect.any(String) },
    ]);
    expect(resolve.mock.calls[1]).toEqual([block.filters, 100]);
    expect(await toPublicBlocks([block], services, context)).toMatchObject([
      { items: ['random'] },
    ]);
    expect(resolve).toHaveBeenCalledTimes(3);
  },
);

it.each([
  new Error('database failure'),
  new ServiceUnavailableException('unrelated outage'),
])('does not disguise ordinary errors: %s', async (failure) => {
  const { services, resolve } = setup();
  resolve.mockRejectedValue(failure);
  await expect(toPublicBlocks([dynamic('a')], services, context)).rejects.toBe(
    failure,
  );
  expect(resolve).toHaveBeenCalledTimes(1);
});

it('propagates a failed Default retry without attempting another fallback', async () => {
  const { services, resolve } = setup();
  const failure = new Error('Default query failed');
  resolve
    .mockRejectedValueOnce(new RandomScanUnavailableException('queue_full'))
    .mockRejectedValueOnce(failure);
  await expect(toPublicBlocks([dynamic('a')], services, context)).rejects.toBe(
    failure,
  );
  expect(resolve).toHaveBeenCalledTimes(2);
});

it('preserves captured Event scope/time/filters/limit on the Default retry', async () => {
  const { services } = setup();
  const resolve = jest
    .fn()
    .mockRejectedValueOnce(new RandomScanUnavailableException('scan_timeout'))
    .mockResolvedValueOnce([]);
  services.findDynamicEventSummaries = resolve;
  const block = {
    ...dynamic('event'),
    entityType: 'events',
    filters: { temporal: { mode: 'past' } },
  };
  await toPublicBlocks([block], services, context);
  expect(resolve.mock.calls[1]).toEqual([
    block.filters,
    100,
    { domainId: context.domainId, now, ordering: undefined },
  ]);
});

it('shares fallback policy through Groups and every embedded container without changing authored data', async () => {
  const { services, resolve } = setup();
  resolve.mockImplementation(async (_filters, _limit, ordering) => {
    if (ordering) throw new RandomScanUnavailableException('queue_full');
    return [{ id: 'default', label: 'Default' }];
  });
  const button = (id: string) => ({ type: 'block', block: dynamic(id) });
  const blocks = [
    dynamic('root'),
    { id: 'group', type: 'group', blocks: [dynamic('group-child')] },
    { id: 'cta', type: 'cta', buttons: [button('cta-child')] },
    { id: 'hero', type: 'hero', items: [{ button: button('hero-child') }] },
    { id: 'html', type: 'html', snippets: [{ button: button('html-child') }] },
    {
      id: 'custom',
      type: 'entityCollection',
      entityType: 'custom',
      itemOrder: 'random',
      customItems: [{ title: 'A', button: button('custom-child') }],
    },
    {
      id: 'manual',
      type: 'entityCollection',
      entityType: 'people',
      itemOrder: 'random',
      items: ['a', 'b', 'a'],
    },
    { id: 'sibling', type: 'richText', content: 'Unaffected' },
  ];
  const saved = JSON.stringify(blocks);
  const result = await toPublicBlocks(blocks, services, context);
  expect(resolve).toHaveBeenCalledTimes(12);
  expect(result[0]).toMatchObject({ items: ['default'] });
  expect(result[1]).toMatchObject({ blocks: [{ items: ['default'] }] });
  expect(result[2]).toMatchObject({
    buttons: [{ block: { items: ['default'] } }],
  });
  expect(result[3]).toMatchObject({
    items: [{ button: { block: { items: ['default'] } } }],
  });
  expect(result[4]).toMatchObject({
    snippets: [{ button: { block: { items: ['default'] } } }],
  });
  expect(result[5]).toMatchObject({
    customItems: [{ button: { block: { items: ['default'] } } }],
  });
  expect(result[7]).toEqual(blocks[7]);
  resolve.mockClear();
  const forced = await toPublicBlocks(blocks, services, context, {
    dynamicRandom: 'default',
  });
  expect(forced).toEqual(result);
  expect(resolve).toHaveBeenCalledTimes(6);
  expect(resolve.mock.calls.every((args) => args.length === 2)).toBe(true);
  expect(JSON.stringify(blocks)).toBe(saved);
});

it('starts distinct conversions without a second admission queue', async () => {
  const { services, resolve } = setup();
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  resolve.mockImplementation(async () => {
    await gate;
    return [];
  });
  const conversion = toPublicBlocks(
    Array.from({ length: 3 }, (_, i) => dynamic(String(i))),
    services,
    context,
  );
  await new Promise<void>((done) => setImmediate(done));
  try {
    expect(resolve).toHaveBeenCalledTimes(3);
  } finally {
    release();
    await conversion;
  }
});

it('identifies the owner and nested path in fallback logs without content or filters', async () => {
  const { services, resolve } = setup();
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  resolve
    .mockRejectedValueOnce(new RandomScanUnavailableException('queue_timeout'))
    .mockResolvedValueOnce([]);
  await toPublicBlocks(
    [{ id: 'group', type: 'group', blocks: [dynamic('child')] }],
    services,
    context,
  );
  expect(warn).toHaveBeenCalledWith({
    event: 'random_default_fallback',
    reason: 'queue_timeout',
    owner: context.owner,
    blockPath: ['group', 'child'],
    entityType: 'people',
  });
});
