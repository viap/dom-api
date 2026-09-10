import { PageBlockType } from '../enums/page-block-type.enum';
import { toPublicBlocks } from './block-validation';

const context = {
  domainId: '507f1f77bcf86cd799439221',
  now: new Date('2026-09-10T12:00:00.000Z'),
};

describe('toPublicBlocks', () => {
  const baseServices = {
    findPublishedPeopleSummariesByIds: jest.fn().mockResolvedValue([]),
    findDynamicPeopleSummaries: jest
      .fn()
      .mockResolvedValue([{ id: 'person-1', label: 'Person' }]),
    findDynamicPartnerSummaries: jest
      .fn()
      .mockResolvedValue([{ id: 'partner-1', label: 'Partner' }]),
    findDynamicEventSummaries: jest
      .fn()
      .mockResolvedValue([{ id: 'event-1', label: 'Event' }]),
  };

  beforeEach(() => jest.clearAllMocks());

  it('materializes dynamic blocks concurrently, preserves order, and strips editor fields', async () => {
    let releasePeople!: () => void;
    const peopleStarted = new Promise<void>((resolve) => {
      baseServices.findDynamicPeopleSummaries.mockImplementationOnce(
        async () => {
          await new Promise<void>((resolve) => {
            releasePeople = resolve;
          });
          return [{ id: 'person-1', label: 'Person' }];
        },
      );
      baseServices.findDynamicPartnerSummaries.mockImplementationOnce(
        async () => {
          resolve();
          return [{ id: 'partner-1', label: 'Partner' }];
        },
      );
    });

    const resultPromise = toPublicBlocks(
      [
        {
          id: 'people',
          type: PageBlockType.EntityCollection,
          entityType: 'people',
          layout: 'grid',
          source: 'dynamic',
          items: [],
          filters: {},
          limit: 4,
        },
        {
          id: 'partners',
          type: PageBlockType.EntityCollection,
          entityType: 'partners',
          layout: 'grid',
          source: 'dynamic',
          items: [],
          filters: {},
          limit: 4,
        },
      ],
      baseServices,
      context,
    );

    await peopleStarted;
    expect(baseServices.findDynamicPartnerSummaries).toHaveBeenCalled();
    releasePeople();

    await expect(resultPromise).resolves.toEqual([
      {
        id: 'people',
        type: PageBlockType.EntityCollection,
        entityType: 'people',
        layout: 'grid',
        items: ['person-1'],
      },
      {
        id: 'partners',
        type: PageBlockType.EntityCollection,
        entityType: 'partners',
        layout: 'grid',
        items: ['partner-1'],
      },
    ]);
  });

  it('propagates a dynamic resolver error instead of returning an empty collection', async () => {
    baseServices.findDynamicPeopleSummaries.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(
      toPublicBlocks(
        [
          {
            id: 'people',
            type: PageBlockType.EntityCollection,
            entityType: 'people',
            layout: 'grid',
            source: 'dynamic',
            items: [],
            filters: {},
          },
        ],
        baseServices,
        context,
      ),
    ).rejects.toThrow('database unavailable');
  });

  it('strips explicit manual source from the public shape', async () => {
    await expect(
      toPublicBlocks(
        [
          {
            id: 'people',
            type: PageBlockType.EntityCollection,
            entityType: 'people',
            layout: 'grid',
            source: 'manual',
            items: ['person-1'],
          },
        ],
        baseServices,
        context,
      ),
    ).resolves.toEqual([
      {
        id: 'people',
        type: PageBlockType.EntityCollection,
        entityType: 'people',
        layout: 'grid',
        items: ['person-1'],
      },
    ]);
  });
});
