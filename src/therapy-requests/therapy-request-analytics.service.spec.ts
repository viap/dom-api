import { TherapyRequestAnalyticsService } from './therapy-request-analytics.service';
import { NotFoundException } from '@nestjs/common';

function chain(result: unknown) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
}

function aggregateChain(result: unknown) {
  return {
    exec: jest.fn().mockResolvedValue(result),
  };
}

function countChain(result: number) {
  return {
    exec: jest.fn().mockResolvedValue(result),
  };
}

const id = (value: string) => ({
  toString: () => value,
});

describe('TherapyRequestAnalyticsService', () => {
  it('returns summary from aggregation with legacy-safe review defaults', async () => {
    const aggregate = jest.fn().mockReturnValue(
      aggregateChain([
        {
          total: [{ total: 2 }],
          reviewRequired: [{ total: 1 }],
          monthlyTotals: [{ _id: '2026-01', total: 2 }],
          monthlyCategories: [
            {
              _id: { month: '2026-01', category: 'individual' },
              total: 1,
            },
            { _id: { month: '2026-01', category: 'unknown' }, total: 1 },
          ],
          monthlyGenders: [
            { _id: { month: '2026-01', gender: 'female' }, total: 1 },
            { _id: { month: '2026-01', gender: 'unknown' }, total: 1 },
          ],
          categoryBreakdown: [
            { _id: 'individual', total: 1 },
            { _id: 'unknown', total: 1 },
          ],
          genderBreakdown: [
            { _id: 'female', total: 1 },
            { _id: 'unknown', total: 1 },
          ],
        },
      ]),
    );
    const service = new TherapyRequestAnalyticsService(
      {
        aggregate,
        distinct: jest.fn(),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    const result = await service.getSummary({
      analyticsReviewRequired: 'true',
    });

    expect(aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            analyticsReviewRequired: { $ne: false },
          },
        },
      ]),
    );
    expect(result).toMatchObject({
      totalRequests: 2,
      reviewRequiredCount: 1,
      monthly: [
        {
          month: '2026-01',
          total: 2,
          byCategory: { individual: 1, unknown: 1 },
          byGender: { female: 1, unknown: 1 },
        },
      ],
    });
  });

  it('returns paginated request-level list responses with projected fields', async () => {
    const rows = [{ _id: id('request-1') }];
    const findChain = chain(rows);
    const find = jest.fn().mockReturnValue(findChain);
    const countDocuments = jest.fn().mockReturnValue(countChain(42));
    const service = new TherapyRequestAnalyticsService(
      {
        find,
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments,
        distinct: jest.fn(),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    const result = await service.getRequests({
      clientGender: 'unknown',
      requestCategory: 'unknown',
      analyticsReviewRequired: 'true',
      limit: '20',
      offset: '40',
    });

    expect(find).toHaveBeenCalledWith({
      clientGender: { $in: ['unknown', null] },
      requestCategory: { $in: ['unknown', null] },
      analyticsReviewRequired: { $ne: false },
    });
    expect(findChain.select).toHaveBeenCalledWith(
      '_id createdAt updatedAt name descr accepted clientGender requestCategory analyticsReviewRequired analyticsInference psychologist',
    );
    expect(findChain.skip).toHaveBeenCalledWith(40);
    expect(findChain.limit).toHaveBeenCalledWith(20);
    expect(countDocuments).toHaveBeenCalledWith({
      clientGender: { $in: ['unknown', null] },
      requestCategory: { $in: ['unknown', null] },
      analyticsReviewRequired: { $ne: false },
    });
    expect(result).toEqual({
      data: rows,
      total: 42,
      page: 3,
      limit: 20,
      totalPages: 3,
    });
  });

  it('returns request detail context with description and projected contacts', async () => {
    const detail = {
      _id: id('507f1f77bcf86cd799439011'),
      descr: 'Client asks for help with family conflict',
      contacts: [
        {
          id: 'telegram',
          network: 'telegram',
          username: '@client',
          hidden: false,
        },
        {
          id: 'phone',
          network: 'phone',
          username: '+995 555 12 34 56',
          hidden: true,
        },
      ],
    };
    const findByIdChain = chain(detail);
    const findById = jest.fn().mockReturnValue(findByIdChain);
    const service = new TherapyRequestAnalyticsService(
      {
        findById,
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    const result = await service.getRequestDetails('507f1f77bcf86cd799439011');

    expect(findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(findByIdChain.select).toHaveBeenCalledWith('_id descr contacts');
    expect(result).toEqual({
      _id: '507f1f77bcf86cd799439011',
      descr: 'Client asks for help with family conflict',
      contacts: [
        {
          id: 'telegram',
          network: 'telegram',
          username: '@client',
          hidden: false,
        },
      ],
    });
  });

  it('rejects invalid request detail ids', async () => {
    const service = new TherapyRequestAnalyticsService(
      {
        findById: jest.fn(),
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    await expect(service.getRequestDetails('not-an-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects missing request detail documents', async () => {
    const service = new TherapyRequestAnalyticsService(
      {
        findById: jest.fn().mockReturnValue(chain(null)),
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    await expect(
      service.getRequestDetails('507f1f77bcf86cd799439011'),
    ).rejects.toThrow(NotFoundException);
  });

  it('uses 20 as the default request page size', async () => {
    const findChain = chain([]);
    const service = new TherapyRequestAnalyticsService(
      {
        find: jest.fn().mockReturnValue(findChain),
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
        distinct: jest.fn(),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    await service.getRequests({});

    expect(findChain.skip).toHaveBeenCalledWith(0);
    expect(findChain.limit).toHaveBeenCalledWith(20);
  });

  it('honors a resolved zero request offset instead of falling back to the raw query', async () => {
    const findChain = chain([]);
    const service = new TherapyRequestAnalyticsService(
      {
        find: jest.fn().mockReturnValue(findChain),
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
        distinct: jest.fn(),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    await (service as any).findRequests(
      { offset: '40', limit: '20' },
      { filter: {}, offset: 0, limit: 20 },
    );

    expect(findChain.skip).toHaveBeenCalledWith(0);
    expect(findChain.limit).toHaveBeenCalledWith(20);
  });

  it('normalizes oversized request offsets to the last available page', async () => {
    const findChain = chain([]);
    const service = new TherapyRequestAnalyticsService(
      {
        find: jest.fn().mockReturnValue(findChain),
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(42)),
        distinct: jest.fn(),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    const result = await service.getRequests({
      limit: '20',
      offset: '50000000',
    });

    expect(findChain.skip).toHaveBeenCalledWith(40);
    expect(result).toEqual({
      data: [],
      total: 42,
      page: 3,
      limit: 20,
      totalPages: 3,
    });
  });

  it('returns psychologist rankings, paginated rows, and total lifecycle row count', async () => {
    const psychologist = {
      _id: id('psychologist-1'),
      user: { name: 'Dr One' },
    };
    const requests = [
      {
        _id: id('request-1'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        name: 'Client One',
        psychologist,
      },
      {
        _id: id('request-2'),
        createdAt: new Date('2026-01-10T00:00:00Z'),
        name: 'Client Two',
        psychologist,
      },
      {
        _id: id('request-3'),
        createdAt: new Date('2026-01-12T00:00:00Z'),
        name: 'Client Three',
        psychologist,
      },
    ];
    const service = new TherapyRequestAnalyticsService(
      {
        find: jest.fn().mockReturnValue(chain(requests)),
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        distinct: jest.fn(),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(
          aggregateChain([
            {
              _id: id('request-1'),
              firstSessionAt: new Date('2026-01-11T00:00:00Z').getTime(),
              latestSessionAt: new Date('2026-01-21T00:00:00Z').getTime(),
              linkedSessionCount: 2,
            },
          ]),
        ),
        countDocuments: jest.fn().mockReturnValue(countChain(3)),
      } as any,
      { find: jest.fn() } as any,
    );

    const result = await service.getLifecycle({
      limit: '1',
      offset: '1',
    });

    expect(result.shortestPsychologists).toHaveLength(1);
    expect(result.shortestPsychologists[0]).toMatchObject({
      psychologistName: 'Dr One',
      averageLifecycleDays: 20,
      medianLifecycleDays: 20,
      requestCount: 1,
      linkedSessionCount: 2,
      noSessionCount: 2,
    });
    expect(result.requestRowsTotal).toBe(3);
    expect(result.requestRows).toEqual([
      expect.objectContaining({
        requestId: 'request-2',
        lifecycleDays: null,
        linkStatus: 'no_sessions',
      }),
    ]);
    expect(result.unlinkedSessionCount).toBe(3);
  });

  it('normalizes oversized lifecycle row offsets to the last available page', async () => {
    const requests = [
      {
        _id: id('request-1'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        name: 'Client One',
        psychologist: {
          _id: id('psychologist-1'),
          user: { name: 'Dr One' },
        },
      },
      {
        _id: id('request-2'),
        createdAt: new Date('2026-01-02T00:00:00Z'),
        name: 'Client Two',
        psychologist: {
          _id: id('psychologist-1'),
          user: { name: 'Dr One' },
        },
      },
      {
        _id: id('request-3'),
        createdAt: new Date('2026-01-03T00:00:00Z'),
        name: 'Client Three',
        psychologist: {
          _id: id('psychologist-1'),
          user: { name: 'Dr One' },
        },
      },
    ];
    const service = new TherapyRequestAnalyticsService(
      {
        find: jest.fn().mockReturnValue(chain(requests)),
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        distinct: jest.fn(),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    const result = await service.getLifecycle({
      limit: '2',
      offset: '50000000',
    });

    expect(result.requestRowsTotal).toBe(3);
    expect(result.requestRows).toEqual([
      expect.objectContaining({
        requestId: 'request-3',
      }),
    ]);
  });

  it('exports an xlsx workbook buffer from a single request fetch', async () => {
    const find = jest.fn().mockReturnValue(chain([]));
    const service = new TherapyRequestAnalyticsService(
      {
        find,
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        distinct: jest.fn(),
      } as any,
      {
        aggregate: jest.fn().mockReturnValue(aggregateChain([])),
        countDocuments: jest.fn().mockReturnValue(countChain(0)),
      } as any,
      { find: jest.fn() } as any,
    );

    const buffer = await service.exportXlsx({});

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(find).toHaveBeenCalledTimes(1);
  });
});
