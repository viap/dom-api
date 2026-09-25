import { PageBlockType } from '../enums/page-block-type.enum';
import { PageBlock } from '../types/page-block.interface';
import { prepareBlocksForWrite, toPublicBlocks } from './block-validation';

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

  it('resolves a dynamic entityCollection embedded in a block button', async () => {
    const [cta] = await toPublicBlocks(
      [
        {
          id: 'cta',
          type: PageBlockType.Cta,
          buttons: [
            {
              label: 'Info',
              type: 'block',
              block: {
                id: 'm',
                type: PageBlockType.EntityCollection,
                entityType: 'people',
                layout: 'grid',
                source: 'dynamic',
                items: [],
                filters: {},
                limit: 4,
              },
            },
          ],
        },
      ],
      baseServices,
      context,
    );

    const embedded = (cta as Record<string, any>).buttons[0].block;
    expect(embedded.items).toEqual(['person-1']);
    expect(embedded.source).toBeUndefined();
  });

  it('strips source from a manual entityCollection embedded in a block button', async () => {
    const [cta] = await toPublicBlocks(
      [
        {
          id: 'cta',
          type: PageBlockType.Cta,
          buttons: [
            {
              label: 'Info',
              type: 'block',
              block: {
                id: 'm',
                type: PageBlockType.EntityCollection,
                entityType: 'people',
                layout: 'grid',
                source: 'manual',
                items: ['person-1'],
              },
            },
          ],
        },
      ],
      baseServices,
      context,
    );

    const embedded = (cta as Record<string, any>).buttons[0].block;
    expect(embedded.items).toEqual(['person-1']);
    expect(embedded.source).toBeUndefined();
  });

  it('caps recursion and drops over-deep embedded blocks from malformed stored data', async () => {
    // A self-referential cycle that only malformed (non-Joi) stored data could
    // contain — Mixed lets it reach Mongo. The read path must terminate.
    const deep: Record<string, any> = {
      id: 'deep',
      type: PageBlockType.RichText,
      buttons: [],
    };
    deep.buttons.push({ label: 'loop', type: 'block', block: deep });

    const [cta] = await toPublicBlocks(
      [
        {
          id: 'cta',
          type: PageBlockType.Cta,
          buttons: [{ label: 'open', type: 'block', block: deep }],
        },
      ],
      baseServices,
      context,
    );

    const level1 = (cta as Record<string, any>).buttons[0].block;
    expect(level1).toBeDefined();
    // Depth-1 resolved, but its own embedded block (depth 2) is dropped.
    expect(level1.buttons[0].block).toBeUndefined();
  });
});

describe('prepareBlocksForWrite embedded blocks', () => {
  const allExist = {
    peopleExistingIds: async (ids: string[]) => new Set(ids),
    partnersExistingIds: async (ids: string[]) => new Set(ids),
    eventsExistingIds: async (ids: string[]) => new Set(ids),
    mediaExistingPublishedIds: async (ids: string[]) => new Set(ids),
    pagesExistingIds: async (ids: string[]) => new Set(ids),
    domainsGetActiveById: async () => ({}),
  };

  const ctaWithBlockButton = (block: unknown) =>
    [
      {
        id: 'cta',
        type: PageBlockType.Cta,
        buttons: [{ label: 'Info', type: 'block', block }],
      },
    ] as unknown as PageBlock[];

  it('sanitizes HTML content inside an embedded block', async () => {
    const [cta] = await prepareBlocksForWrite(
      ctaWithBlockButton({
        id: 'm',
        type: PageBlockType.Html,
        content: '<p>ok</p><iframe src="https://evil.com"></iframe>',
      }),
      allExist,
    );

    expect((cta as Record<string, any>).buttons[0].block.content).toBe(
      '<p>ok</p>',
    );
  });

  it('existence-checks refs collected from an embedded block', async () => {
    await expect(
      prepareBlocksForWrite(
        ctaWithBlockButton({
          id: 'm',
          type: PageBlockType.EntityCollection,
          entityType: 'people',
          layout: 'grid',
          items: ['507f1f77bcf86cd799439299'],
        }),
        { ...allExist, peopleExistingIds: async () => new Set<string>() },
      ),
    ).rejects.toThrow(/Referenced person not found/);
  });
});
