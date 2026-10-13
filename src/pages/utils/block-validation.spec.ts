import { PageBlockType } from '../enums/page-block-type.enum';
import { PageBlock, PageRootBlock } from '../types/page-block.interface';
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

  it('preserves Custom item order and materializes an embedded dynamic block', async () => {
    const [custom] = await toPublicBlocks(
      [
        {
          id: 'custom',
          type: PageBlockType.EntityCollection,
          entityType: 'custom',
          layout: 'grid',
          items: [],
          customItems: [
            { title: 'First' },
            {
              title: 'Second',
              button: {
                label: 'Open people',
                type: 'block',
                block: {
                  id: 'embedded-people',
                  type: PageBlockType.EntityCollection,
                  entityType: 'people',
                  layout: 'list',
                  source: 'dynamic',
                  items: [],
                  filters: {},
                  limit: 4,
                },
              },
            },
          ],
        },
      ],
      baseServices,
      context,
    );

    const publicCustom = custom as Record<string, any>;
    expect(publicCustom.items).toEqual([]);
    expect(
      publicCustom.customItems.map((item: { title: string }) => item.title),
    ).toEqual(['First', 'Second']);
    expect(publicCustom.customItems[1].button.block).toEqual(
      expect.objectContaining({
        id: 'embedded-people',
        items: ['person-1'],
      }),
    );
    expect(publicCustom.customItems[1].button.block.source).toBeUndefined();
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

  it('collects Custom media and button references and sanitizes item modal content', async () => {
    const mediaId = '507f1f77bcf86cd799439291';
    const pageId = '507f1f77bcf86cd799439292';
    const mediaExistingPublishedIds = jest
      .fn()
      .mockImplementation(async (ids: string[]) => new Set(ids));
    const pagesExistingIds = jest
      .fn()
      .mockImplementation(async (ids: string[]) => new Set(ids));

    const [custom] = await prepareBlocksForWrite(
      [
        {
          id: 'custom',
          type: PageBlockType.EntityCollection,
          entityType: 'custom',
          layout: 'grid',
          items: [],
          customItems: [
            {
              mediaId,
              title: 'Linked card',
              button: {
                label: 'Read more',
                type: 'page',
                targetId: pageId,
              },
            },
            {
              title: 'Modal card',
              button: {
                label: 'Open',
                type: 'block',
                block: {
                  id: 'modal-html',
                  type: PageBlockType.Html,
                  template: 'vertical',
                  content:
                    '<p>Allowed</p><iframe src="https://evil.example"></iframe>',
                },
              },
            },
          ],
        },
      ] as PageBlock[],
      {
        ...allExist,
        mediaExistingPublishedIds,
        pagesExistingIds,
      },
    );

    expect(mediaExistingPublishedIds).toHaveBeenCalledWith([mediaId]);
    expect(pagesExistingIds).toHaveBeenCalledWith([pageId]);
    expect(
      (custom as Record<string, any>).customItems[1].button.block.content,
    ).toBe('<p>Allowed</p>');
  });

  it('rejects a missing published media reference from a Custom item', async () => {
    await expect(
      prepareBlocksForWrite(
        [
          {
            id: 'custom',
            type: PageBlockType.EntityCollection,
            entityType: 'custom',
            layout: 'grid',
            items: [],
            customItems: [
              {
                mediaId: '507f1f77bcf86cd799439293',
                title: 'Missing image',
              },
            ],
          },
        ] as PageBlock[],
        {
          ...allExist,
          mediaExistingPublishedIds: async () => new Set<string>(),
        },
      ),
    ).rejects.toThrow(/Referenced published media not found/);
  });
});

describe('Group blocks (page-only)', () => {
  const allExist = {
    peopleExistingIds: async (ids: string[]) => new Set(ids),
    partnersExistingIds: async (ids: string[]) => new Set(ids),
    eventsExistingIds: async (ids: string[]) => new Set(ids),
    mediaExistingPublishedIds: async (ids: string[]) => new Set(ids),
    pagesExistingIds: async (ids: string[]) => new Set(ids),
    domainsGetActiveById: async () => ({}),
  };

  const publicServices = {
    findPublishedPeopleSummariesByIds: async () => [],
    findDynamicPeopleSummaries: async () => [],
    findDynamicPartnerSummaries: async () => [],
    findDynamicEventSummaries: async () => [],
  };

  const htmlChild = (id: string, content = '<p>ok</p>') => ({
    id,
    type: PageBlockType.Html,
    template: 'vertical',
    content,
  });

  it('drops a hidden child inside a visible group on public read', async () => {
    const result = await toPublicBlocks(
      [
        {
          id: 'grp',
          type: PageBlockType.Group,
          isVisible: true,
          blocks: [htmlChild('c1'), { ...htmlChild('c2'), isVisible: false }],
        },
      ],
      publicServices,
      context,
    );

    const group = result[0] as Record<string, any>;
    expect(group.blocks).toHaveLength(1);
    expect(group.blocks[0].id).toBe('c1');
  });

  it('sanitizes an HTML child inside a group on write', async () => {
    const [group] = await prepareBlocksForWrite(
      [
        {
          id: 'grp',
          type: PageBlockType.Group,
          blocks: [
            htmlChild(
              'c1',
              '<p>ok</p><iframe src="https://evil.com"></iframe>',
            ),
          ],
        },
      ] as unknown as PageRootBlock[],
      allExist,
    );

    expect((group as Record<string, any>).blocks[0].content).toBe('<p>ok</p>');
  });

  it('flags a duplicate id between a root block and a group child (tree-wide)', async () => {
    await expect(
      prepareBlocksForWrite(
        [
          htmlChild('dup'),
          {
            id: 'grp',
            type: PageBlockType.Group,
            blocks: [htmlChild('dup')],
          },
        ] as unknown as PageRootBlock[],
        allExist,
      ),
    ).rejects.toThrow(/Duplicate block id/);
  });

  it('existence-checks refs collected from a group child', async () => {
    await expect(
      prepareBlocksForWrite(
        [
          {
            id: 'grp',
            type: PageBlockType.Group,
            blocks: [
              {
                id: 'team',
                type: PageBlockType.EntityCollection,
                entityType: 'people',
                layout: 'grid',
                items: ['507f1f77bcf86cd799439299'],
              },
            ],
          },
        ] as unknown as PageRootBlock[],
        { ...allExist, peopleExistingIds: async () => new Set<string>() },
      ),
    ).rejects.toThrow(/Referenced person not found/);
  });
});
