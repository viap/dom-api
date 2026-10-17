import { withHeroItemButtons } from './block-buttons';
import { PageBlockType } from '../enums/page-block-type.enum';
import { PageBlock, PageRootBlock } from '../types/page-block.interface';
import { prepareBlocksForWrite, toPublicBlocks } from './block-validation';

const context = {
  owner: { kind: 'page' as const, pageId: '507f1f77bcf86cd799439221' },
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

  it('filters hidden buttons before resolution across public consumers and respects Hero array precedence', async () => {
    const hidden = {
      label: 'Hidden',
      type: 'block',
      isVisible: false,
      block: {
        id: 'dynamic',
        type: 'entityCollection',
        entityType: 'people',
        layout: 'grid',
        source: 'dynamic',
        filters: {},
        items: [],
      },
    };
    const visible = {
      label: 'Visible',
      type: 'external',
      url: 'https://example.com',
    };
    const source = [
      {
        id: 'hero',
        type: 'hero',
        items: [
          {
            title: 'Many',
            button: hidden,
            buttons: [visible, hidden, visible],
          },
          { title: 'Empty', button: visible, buttons: [] },
          { title: 'Legacy', button: hidden },
        ],
      },
      { id: 'cta', type: 'cta', buttons: [hidden, visible] },
      { id: 'text', type: 'richText', buttons: [hidden] },
      {
        id: 'custom',
        type: 'entityCollection',
        entityType: 'custom',
        layout: 'grid',
        items: [],
        customItems: [{ title: 'Card', button: hidden }],
      },
      {
        id: 'html',
        type: 'html',
        template: 'vertical',
        content:
          '<p>Before</p><span data-dom-html-snippet="button" data-dom-html-snippet-id="saved"></span><p>After</p>',
        snippets: [{ id: 'saved', type: 'button', button: hidden }],
      },
    ];
    const snapshot = JSON.stringify(source);
    const result = (await toPublicBlocks(
      source,
      baseServices,
      context,
    )) as Record<string, any>[];
    expect(result[0].items[0].buttons).toEqual([visible, visible]);
    expect(result[0].items[0].button).toBeUndefined();
    expect(result[0].items[1].buttons).toEqual([]);
    expect(result[0].items[2].button).toBeUndefined();
    expect(result[1].buttons).toEqual([visible]);
    expect(result[2].buttons).toEqual([]);
    expect(result[3].customItems[0].button).toBeUndefined();
    expect(result[4].snippets[0]).toEqual({
      id: 'saved',
      type: 'button',
      button: { type: hidden.type, label: hidden.label, isVisible: false },
    });
    expect(JSON.stringify(result[4])).not.toContain('"source"');
    expect(JSON.stringify(result[4])).not.toContain('"filters"');
    expect(result[4].content).toBe(source[4].content);
    expect(baseServices.findDynamicPeopleSummaries).not.toHaveBeenCalled();
    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it.each(['external', 'page', 'domain', 'application', 'block'])(
    'reduces hidden %s snippets to a public placeholder',
    async (type) => {
      const button = {
        type,
        label: 'Staged action',
        isVisible: false,
        url: 'https://private.example.com',
        targetId: 'private-target',
        applicationProgramId: 'private-program',
        applicationEventId: 'private-event',
        applicationModalTitle: 'Private title',
        openInNewTab: true,
        style: 'outline',
        block: {
          id: 'private-block',
          type: 'entityCollection',
          entityType: 'people',
          layout: 'grid',
          source: 'dynamic',
          filters: {},
          limit: 12,
          items: [],
        },
      };
      const source = [
        {
          id: 'html',
          type: 'html',
          template: 'vertical',
          content:
            '<p>Before</p><span data-dom-html-snippet="button" data-dom-html-snippet-id="hidden"></span><p>After</p>',
          snippets: [{ id: 'hidden', type: 'button', button }],
        },
      ];
      const before = JSON.stringify(source);
      const result = await toPublicBlocks(source, baseServices, context);
      expect(result).toEqual([
        {
          ...source[0],
          snippets: [
            {
              id: 'hidden',
              type: 'button',
              button: { type, label: 'Staged action', isVisible: false },
            },
          ],
        },
      ]);
      expect(baseServices.findDynamicPeopleSummaries).not.toHaveBeenCalled();
      expect(JSON.stringify(source)).toBe(before);
    },
  );

  it('filters hidden Hero items before resolving buttons without mutating admin data', async () => {
    const blocks: Record<string, unknown>[] = [
      {
        id: 'hero',
        type: PageBlockType.Hero,
        sectionSpacing: 'sm',
        columns: 4,
        items: [
          { title: 'First' },
          {
            title: 'Hidden',
            isVisible: false,
            button: {
              label: 'Hidden action',
              type: 'block',
              block: {
                id: 'hidden-dynamic',
                type: PageBlockType.EntityCollection,
                entityType: 'people',
                layout: 'grid',
                source: 'dynamic',
                filters: {},
                items: [],
                limit: 4,
              },
            },
          },
          { title: 'Last', isVisible: true },
        ],
      },
    ];
    const before = JSON.stringify(blocks);
    const result = await toPublicBlocks(blocks, baseServices, context);
    expect(result[0]).toMatchObject({
      sectionSpacing: 'sm',
      columns: 4,
      items: [{ title: 'First' }, { title: 'Last' }],
    });
    expect(baseServices.findDynamicPeopleSummaries).not.toHaveBeenCalled();
    expect(JSON.stringify(blocks)).toBe(before);
  });

  it.each([{ items: [] }, { items: [{ title: 'Hidden', isVisible: false }] }])(
    'returns empty Hero public items for %j',
    async ({ items }) => {
      const result = await toPublicBlocks(
        [{ id: 'hero', type: PageBlockType.Hero, title: 'Heading', items }],
        baseServices,
        context,
      );
      expect(result[0]).toMatchObject({ title: 'Heading', items: [] });
    },
  );

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

  it('validates later hidden Hero references and normalizes their embedded blocks', async () => {
    const pageId = '507f1f77bcf86cd799439251';
    const pagesExistingIds = jest.fn().mockResolvedValue(new Set([pageId]));
    const source = [
      {
        id: 'hero',
        type: 'hero',
        items: [
          {
            title: 'Card',
            buttons: [
              { label: 'First', type: 'external', url: 'https://example.com' },
              {
                label: 'Page',
                type: 'page',
                isVisible: false,
                targetId: pageId,
              },
              {
                label: 'Modal',
                type: 'block',
                isVisible: false,
                block: {
                  id: 'inner',
                  type: 'html',
                  template: 'vertical',
                  content:
                    '<p>Keep</p><iframe src="https://evil.com"></iframe>',
                },
              },
            ],
          },
        ],
      },
    ] as unknown as PageRootBlock[];
    const saved = (await prepareBlocksForWrite(source, {
      ...allExist,
      pagesExistingIds,
    })) as Record<string, any>[];
    expect(pagesExistingIds).toHaveBeenCalledWith([pageId]);
    expect(saved[0].items[0].buttons[2].block.content).toBe('<p>Keep</p>');
    expect(saved[0].items[0].buttons[2].isVisible).toBe(false);
    await expect(
      prepareBlocksForWrite(source, {
        ...allExist,
        pagesExistingIds: async () => new Set<string>(),
      }),
    ).rejects.toThrow();
  });

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

describe('HTML button snippet validation and public conversion', () => {
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
    findDynamicEventSummaries: async () => [
      { id: 'resolved-event', label: 'Resolved event' },
    ],
  };
  const marker = (id: string, type = 'button') =>
    `<span data-dom-html-snippet="${type}" data-dom-html-snippet-id="${id}"></span>`;
  const htmlBlock = (content: string, snippets: unknown[]): PageBlock =>
    ({
      id: 'html',
      type: PageBlockType.Html,
      template: 'vertical',
      content,
      snippets,
    } as unknown as PageBlock);

  it('sanitizes before enforcing marker/configuration integrity', async () => {
    await expect(
      prepareBlocksForWrite(
        [
          htmlBlock(`<template>${marker('removed')}</template><p>Safe</p>`, [
            {
              id: 'removed',
              type: 'button',
              button: {
                label: 'Visit',
                type: 'external',
                url: 'https://example.com',
              },
            },
          ]),
        ],
        allExist,
      ),
    ).rejects.toThrow(/orphan-configuration:removed/);
  });

  it.each([
    {
      name: 'missing configuration',
      content: marker('missing'),
      snippets: [],
      message: 'missing-configuration:missing',
    },
    {
      name: 'orphan configuration',
      content: '<p>No marker</p>',
      snippets: [
        {
          id: 'orphan',
          type: 'button',
          button: {
            label: 'Visit',
            type: 'external',
            url: 'https://example.com',
          },
        },
      ],
      message: 'orphan-configuration:orphan',
    },
    {
      name: 'duplicate marker',
      content: `${marker('duplicate')}${marker('duplicate')}`,
      snippets: [
        {
          id: 'duplicate',
          type: 'button',
          button: {
            label: 'Visit',
            type: 'external',
            url: 'https://example.com',
          },
        },
      ],
      message: 'duplicate-marker:duplicate',
    },
    {
      name: 'type mismatch',
      content: marker('mismatch', 'future'),
      snippets: [
        {
          id: 'mismatch',
          type: 'button',
          button: {
            label: 'Visit',
            type: 'external',
            url: 'https://example.com',
          },
        },
      ],
      message: 'type-mismatch:mismatch',
    },
  ])('rejects $name', async ({ content, snippets, message }) => {
    await expect(
      prepareBlocksForWrite([htmlBlock(content, snippets)], allExist),
    ).rejects.toThrow(message);
  });

  it('collects page and domain references from snippet buttons', async () => {
    const pageId = '507f1f77bcf86cd799439251';
    const domainId = '507f1f77bcf86cd799439252';
    const pagesExistingIds = jest
      .fn()
      .mockImplementation(async (ids: string[]) => new Set(ids));
    const domainsGetActiveById = jest.fn().mockResolvedValue({});

    await prepareBlocksForWrite(
      [
        htmlBlock(`${marker('page')}${marker('domain')}`, [
          {
            id: 'page',
            type: 'button',
            button: { label: 'Page', type: 'page', targetId: pageId },
          },
          {
            id: 'domain',
            type: 'button',
            button: { label: 'Domain', type: 'domain', targetId: domainId },
          },
        ]),
      ],
      { ...allExist, pagesExistingIds, domainsGetActiveById },
    );

    expect(pagesExistingIds).toHaveBeenCalledWith([pageId]);
    expect(domainsGetActiveById).toHaveBeenCalledWith(domainId);
  });

  it('resolves a snippet-owned dynamic embedded block on public conversion', async () => {
    const [html] = await toPublicBlocks(
      [
        htmlBlock(marker('dynamic'), [
          {
            id: 'dynamic',
            type: 'button',
            button: {
              label: 'Events',
              type: 'block',
              block: {
                id: 'dynamic-events',
                type: PageBlockType.EntityCollection,
                entityType: 'events',
                source: 'dynamic',
                layout: 'grid',
                items: [],
                filters: { lifecycle: 'active' },
              },
            },
          },
        ]),
      ],
      publicServices,
      context,
    );

    expect(
      (html as Record<string, any>).snippets[0].button.block.items,
    ).toEqual(['resolved-event']);
  });
});

describe('withHeroItemButtons', () => {
  const legacy = { label: 'Legacy' };
  const first = { label: 'First', isVisible: false };
  const last = { label: 'Last' };

  it.each([
    {
      item: { title: 'Missing' },
      expected: { title: 'Missing', button: first },
    },
    {
      item: { title: 'Legacy', button: legacy },
      expected: { title: 'Legacy', button: first },
    },
    {
      item: { title: 'Empty array', button: legacy, buttons: [] },
      expected: {
        title: 'Empty array',
        button: undefined,
        buttons: [first, last],
      },
    },
    {
      item: { title: 'Array', button: legacy, buttons: [legacy] },
      expected: { title: 'Array', button: undefined, buttons: [first, last] },
    },
  ])(
    'preserves the authored shape for $item.title without mutation',
    ({ item, expected }) => {
      const before = structuredClone(item);
      const buttons = [first, last];
      const result = withHeroItemButtons(item, buttons);
      expect(result).toEqual(expected);
      expect(result).not.toBe(item);
      expect(item).toEqual(before);
      expect(buttons).toEqual([first, last]);
    },
  );
});
