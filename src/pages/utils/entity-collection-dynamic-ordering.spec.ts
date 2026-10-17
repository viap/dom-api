import {
  permuteItems,
  processRandomScans,
  previewRandomScans,
} from '@/common/utils/ranked-query';
import { PeopleService } from '@/people/people.service';
import { PartnersService } from '@/partners/partners.service';
import { EventsService } from '@/events/events.service';
import { createRandomOrdering } from './entity-collection-ordering';
import { DynamicEntityCollectionResolutionContext } from '@/pages/types/page-block.interface';
import { EventEntityCollectionFilters } from '@/events/types/entity-collection-filters.interface';

const now = new Date('2026-10-15T12:00:00Z');
function setup(entityType: 'people' | 'partners' | 'events', count = 100) {
  const rows = Array.from({ length: count }, (_, index) => ({
    _id: String(index).padStart(24, '0'),
    fullName: `Person ${index}`,
    title: `Title ${index}`,
    type: 'seminar',
    startAt: index % 2 ? '2026-10-14T00:00:00Z' : '2026-10-16T00:00:00Z',
    endAt: index % 2 ? '2026-10-14T01:00:00Z' : '2026-10-16T01:00:00Z',
    locationId: undefined as string | undefined,
    workLocationId: undefined as string | undefined,
  }));
  const close = jest.fn(async () => undefined);
  const chain = {
    maxTimeMS: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    cursor: jest.fn(() => ({
      async *[Symbol.asyncIterator]() {
        yield* rows;
      },
      close,
    })),
  };
  const model = {
    find: jest.fn((_query: unknown) => {
      void _query;
      return chain;
    }),
  };
  const locations = { findManyByIds: jest.fn(async () => ({ items: [] })) };
  const domains = { findAll: jest.fn(async () => [{ _id: 'domain' }]) };
  const empty = {} as never;
  const service =
    entityType === 'people'
      ? new PeopleService(model as never, empty, empty, locations as never)
      : entityType === 'partners'
      ? new PartnersService(model as never, empty)
      : new EventsService(
          model as never,
          empty,
          domains as never,
          locations as never,
          empty,
          empty,
          empty,
        );
  const context: DynamicEntityCollectionResolutionContext & {
    blockPath: string[];
  } = {
    now,
    owner: { kind: 'page', pageId: 'page' },
    blockPath: ['collection'],
    domainId: 'domain',
  };
  context.ordering = createRandomOrdering(context, entityType);
  const resolver = {
    findDynamicSummaries: (
      filters: EventEntityCollectionFilters,
      limit: number,
      ctx: typeof context,
    ) =>
      entityType === 'events'
        ? (service as EventsService).findDynamicSummaries(filters, limit, ctx)
        : (service as PeopleService).findDynamicSummaries(
            filters as never,
            limit,
            ctx.ordering,
          ),
    findDynamicPreviewItems: (
      filters: EventEntityCollectionFilters,
      limit: number,
      ctx: typeof context,
      signal?: AbortSignal,
    ) =>
      entityType === 'events'
        ? (service as EventsService).findDynamicPreviewItems(
            filters,
            limit,
            ctx,
            signal,
          )
        : (service as PeopleService).findDynamicPreviewItems(
            filters as never,
            limit,
            ctx.ordering,
            signal,
          ),
  };
  return {
    rows,
    close,
    chain,
    model,
    service: resolver,
    context,
    locations,
    domains,
  };
}

describe('Random Dynamic cursor integration', () => {
  it.each(['people', 'partners', 'events'] as const)(
    '%s scans full eligible projections and limits after ranking, without refetch',
    async (type) => {
      const { service, rows, chain, model, context, close } = setup(type);
      const expected = permuteItems(
        rows,
        context.ordering?.seed,
        (row) => row._id,
      ).slice(0, 4);
      const summaries = await service.findDynamicSummaries({}, 4, context);
      expect(summaries.map((row) => row.id)).toEqual(
        expected.map((row) => row._id),
      );
      expect(model.find).toHaveBeenCalledTimes(1);
      expect(chain.limit).not.toHaveBeenCalled();
      expect(chain.sort).not.toHaveBeenCalled();
      expect(chain.select).toHaveBeenCalledWith(
        type === 'people' ? { _id: 1, fullName: 1 } : { _id: 1, title: 1 },
      );
      expect(close).toHaveBeenCalledTimes(1);
      const preview = await service.findDynamicPreviewItems({}, 4, context);
      expect(preview.map((row) => row.id)).toEqual(
        summaries.map((row) => row.id),
      );
      expect(model.find).toHaveBeenCalledTimes(2);
    },
  );

  it('keeps people/partner eligibility on the cursor query', async () => {
    const people = setup('people');
    await people.service.findDynamicSummaries(
      { languages: ['en'], specializations: [' trauma '] } as never,
      2,
      people.context,
    );
    expect(people.model.find).toHaveBeenCalledWith({
      isPublished: true,
      languages: { $in: ['en'] },
      specializations: { $in: ['trauma'] },
    });
    const partners = setup('partners');
    await partners.service.findDynamicSummaries(
      { types: ['sponsor'] } as never,
      2,
      partners.context,
    );
    expect(partners.model.find).toHaveBeenCalledWith({
      isPublished: true,
      type: { $in: ['sponsor'] },
    });
  });

  it('unfiltered Events ranks past and future together, with no temporal query preference', async () => {
    const { service, model, context, rows } = setup('events');
    const result = await service.findDynamicSummaries({}, 24, context);
    const query = model.find.mock.calls[0][0];
    expect(query).not.toHaveProperty('startAt');
    expect(query).not.toHaveProperty('endAt');
    expect(query).toMatchObject({
      domainId: { $in: ['domain'] },
      status: {
        $in: [
          'planned',
          'registration_open',
          'ongoing',
          'completed',
          'cancelled',
        ],
      },
    });
    const parity = new Set(
      result.map((row) => rows.findIndex((item) => item._id === row.id) % 2),
    );
    expect(parity.size).toBe(2);
  });

  it.each([
    [{ mode: 'upcoming' }, { endAt: { $gte: now.toISOString() } }],
    [{ mode: 'past' }, { endAt: { $lt: now.toISOString() } }],
    [
      { mode: 'custom', from: '2026-10-01', to: '2026-10-31' },
      {
        endAt: { $gte: '2026-09-30T20:00:00.000Z' },
        startAt: { $lt: '2026-10-31T20:00:00.000Z' },
      },
    ],
  ])(
    'retains Event temporal eligibility for summary and preview: %j',
    async (temporal, expected) => {
      const { service, model, context } = setup('events');
      const filters = {
        temporal,
        lifecycle: 'active',
        locationIds: ['location'],
        peopleIds: ['person'],
        types: ['seminar'],
      } as EventEntityCollectionFilters;
      await service.findDynamicSummaries(filters as never, 4, context);
      await service.findDynamicPreviewItems(filters as never, 4, context);
      expect(model.find).toHaveBeenCalledTimes(2);
      const query = model.find.mock.calls[0][0];
      expect(query).toMatchObject({
        ...expected,
        status: { $in: ['planned', 'registration_open', 'ongoing'] },
        locationId: { $in: ['location'] },
        type: { $in: ['seminar'] },
        $or: [
          { speakerIds: { $in: ['person'] } },
          { organizerIds: { $in: ['person'] } },
        ],
      });
      expect(model.find.mock.calls[1][0]).toEqual(query);
    },
  );
  it.each(['people', 'events'] as const)(
    '%s enriches locations only for selected preview documents',
    async (type) => {
      const { service, context, rows, locations } = setup(type);
      rows.forEach((row) => {
        row.workLocationId = row._id;
        row.locationId = row._id;
      });
      const preview = await service.findDynamicPreviewItems({}, 3, context);
      expect(locations.findManyByIds).toHaveBeenCalledTimes(1);
      expect(locations.findManyByIds).toHaveBeenCalledWith(
        preview.map((row) => row.id),
      );
    },
  );
});

it.each(['people', 'partners', 'events'] as const)(
  '%s selects 100 Random items from the complete larger pool',
  async (type) => {
    const { service, rows, chain, context } = setup(type, 200);
    const expected = permuteItems(
      rows,
      context.ordering?.seed,
      (row) => row._id,
    )
      .slice(0, 100)
      .map((row) => row._id);
    const summaries = await service.findDynamicSummaries({}, 100, context);
    const preview = await service.findDynamicPreviewItems({}, 100, context);
    expect(summaries.map((row) => row.id)).toEqual(expected);
    expect(preview.map((row) => row.id)).toEqual(expected);
    expect(chain.limit).not.toHaveBeenCalled();
  },
);

it('uses the complete resolved domain pool for global Random Events', async () => {
  const { service, context, model } = setup('events');
  await service.findDynamicSummaries({}, 100, {
    ...context,
    domainId: undefined,
  });
  expect(model.find.mock.calls[0][0]).toMatchObject({
    domainId: { $in: ['domain'] },
  });
  expect(model.find.mock.calls[0][0]).not.toHaveProperty('endAt');
});

it.each(['people', 'partners', 'events'] as const)(
  '%s routes fresh previews to their own admission budget',
  async (type) => {
    const publicRun = jest.spyOn(processRandomScans, 'run');
    const previewRun = jest.spyOn(previewRandomScans, 'run');
    try {
      const { service, context } = setup(type);
      await service.findDynamicSummaries({}, 3, context);
      expect(publicRun).toHaveBeenCalledTimes(1);
      expect(previewRun).not.toHaveBeenCalled();
      await service.findDynamicPreviewItems({}, 3, context);
      await service.findDynamicPreviewItems({}, 3, context);
      expect(publicRun).toHaveBeenCalledTimes(1);
      expect(previewRun).toHaveBeenCalledTimes(2);
    } finally {
      publicRun.mockRestore();
      previewRun.mockRestore();
    }
  },
);

it.each(['people', 'partners', 'events'] as const)(
  '%s preview cancellation skips resolver work before admission',
  async (type) => {
    const { service, context, model, domains, locations } = setup(type);
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.findDynamicPreviewItems(
        {},
        100,
        { ...context, domainId: undefined },
        controller.signal,
      ),
    ).rejects.toBe(controller.signal.reason);
    expect(model.find).not.toHaveBeenCalled();
    expect(domains.findAll).not.toHaveBeenCalled();
    expect(locations.findManyByIds).not.toHaveBeenCalled();
  },
);

it('Event preview cancellation after domain lookup prevents starting a scan', async () => {
  const { service, context, model, domains } = setup('events');
  const controller = new AbortController();
  domains.findAll.mockImplementation(async () => {
    controller.abort();
    return [{ _id: 'domain' }];
  });
  await expect(
    service.findDynamicPreviewItems(
      {},
      100,
      { ...context, domainId: undefined },
      controller.signal,
    ),
  ).rejects.toBe(controller.signal.reason);
  expect(model.find).not.toHaveBeenCalled();
});
