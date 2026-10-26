import mongoose from 'mongoose';
import { pageSchema } from './page.schema';
import { domainEventSchema } from '@/events/schemas/domain-event.schema';

// Model validation only (no DB connection). validateSync exercises the
// registered block discriminators, including the Group nested-children path and
// the page/event isolation (§9).
const PageModel =
  mongoose.models.PageGroupTest || mongoose.model('PageGroupTest', pageSchema);
const EventModel =
  mongoose.models.EventGroupTest ||
  mongoose.model('EventGroupTest', domainEventSchema);

const htmlChild = (id: string) => ({
  id,
  type: 'html',
  template: 'vertical',
  content: '<p>x</p>',
});

const basePage = {
  slug: 'p',
  title: 'P',
  status: 'draft',
  isHomepage: false,
  isTitleVisible: true,
};

const baseEvent = {
  domainId: new mongoose.Types.ObjectId(),
  type: 'seminar',
  status: 'draft',
  title: 'E',
  slug: 'e',
  startAt: '2026-01-01T10:00:00.000Z',
  endAt: '2026-01-01T12:00:00.000Z',
};

describe('Page group block persistence (Mongoose)', () => {
  it('persists strict typed HTML button snippets without subdocument ids', () => {
    const doc = new PageModel({
      ...basePage,
      blocks: [
        {
          ...htmlChild('snippet-html'),
          content:
            '<span data-dom-html-snippet="button" data-dom-html-snippet-id="snippet-1"></span>',
          snippets: [
            {
              id: 'snippet-1',
              type: 'button',
              button: {
                label: 'Visit',
                type: 'external',
                url: 'https://example.com',
              },
            },
          ],
        },
      ],
    });

    expect(doc.validateSync()).toBeUndefined();
    const stored = doc.toObject().blocks[0] as Record<string, any>;
    expect(stored.snippets[0]).toEqual(
      expect.objectContaining({ id: 'snippet-1', type: 'button' }),
    );
    expect(stored.snippets[0]._id).toBeUndefined();
  });

  it('rejects unknown fields in strict HTML snippet subdocuments', () => {
    const doc = new PageModel({
      ...basePage,
      blocks: [
        {
          ...htmlChild('snippet-html'),
          snippets: [
            {
              id: 'snippet-1',
              type: 'button',
              button: {
                label: 'Visit',
                type: 'external',
                url: 'https://example.com',
              },
              unexpected: true,
            },
          ],
        },
      ],
    });

    expect(doc.validateSync()).toBeDefined();
  });

  it('persists strict Custom items while retaining an empty string items array', () => {
    const doc = new PageModel({
      ...basePage,
      blocks: [
        {
          id: 'custom',
          type: 'entityCollection',
          entityType: 'custom',
          layout: 'grid',
          items: [],
          customItems: [
            {
              mediaId: '507f1f77bcf86cd799439221',
              title: 'Card',
              button: {
                label: 'More',
                type: 'external',
                url: 'https://example.com',
              },
            },
          ],
        },
      ],
    });

    expect(doc.validateSync()).toBeUndefined();
    const stored = doc.toObject().blocks[0] as Record<string, any>;
    expect(stored.items).toEqual([]);
    expect(stored.customItems).toEqual([
      expect.objectContaining({
        mediaId: '507f1f77bcf86cd799439221',
        title: 'Card',
      }),
    ]);
    expect(stored.customItems[0].button).toEqual(
      expect.objectContaining({ type: 'external' }),
    );
  });

  it('rejects unknown fields in strict Custom item subdocuments', () => {
    const doc = new PageModel({
      ...basePage,
      blocks: [
        {
          id: 'custom',
          type: 'entityCollection',
          entityType: 'custom',
          layout: 'grid',
          items: [],
          customItems: [{ title: 'Card', alt: 'not persisted' }],
        },
      ],
    });

    expect(doc.validateSync()).toBeDefined();
  });
  it('validates a group with leaf children and keeps child discriminator fields', () => {
    const doc = new PageModel({
      ...basePage,
      blocks: [
        {
          id: 'g',
          type: 'group',
          blocks: [htmlChild('c1'), htmlChild('c2')],
        },
      ],
    });

    expect(doc.validateSync()).toBeUndefined();

    const stored = doc.toObject().blocks[0] as Record<string, any>;
    expect(stored.blocks).toHaveLength(2);
    // The nested child discriminator applied (html-specific field survives).
    expect(stored.blocks[0].content).toBe('<p>x</p>');
  });

  it.each([undefined, 'horizontal', 'vertical'])(
    'round-trips Group layout %p without materializing a default',
    (layout) => {
      const doc = new PageModel({
        ...basePage,
        blocks: [
          {
            id: 'g',
            type: 'group',
            ...(layout === undefined ? {} : { layout }),
            blocks: [{ ...htmlChild('c1'), padding: 'xl' }],
          },
        ],
      });

      expect(doc.validateSync()).toBeUndefined();
      const stored = doc.toObject().blocks[0] as Record<string, any>;
      expect(stored.layout).toBe(layout);
      expect(stored.blocks[0].padding).toBe('xl');
    },
  );

  it.each(['diagonal', '', null, 1, {}])(
    'rejects invalid Group layout %p',
    (layout) => {
      const doc = new PageModel({
        ...basePage,
        blocks: [{ id: 'g', type: 'group', layout, blocks: [htmlChild('c1')] }],
      });
      expect(doc.validateSync()).toBeDefined();
    },
  );

  it.each([1, 4])('accepts %i Group children', (childCount) => {
    const doc = new PageModel({
      ...basePage,
      blocks: [
        {
          id: 'g',
          type: 'group',
          layout: 'vertical',
          blocks: Array.from({ length: childCount }, (_, index) =>
            htmlChild(`c${index + 1}`),
          ),
        },
      ],
    });
    expect(doc.validateSync()).toBeUndefined();
  });

  it.each([0, 5])('rejects %i Group children', (childCount) => {
    const doc = new PageModel({
      ...basePage,
      blocks: [
        {
          id: 'g',
          type: 'group',
          layout: 'horizontal',
          blocks: Array.from({ length: childCount }, (_, index) =>
            htmlChild(`c${index + 1}`),
          ),
        },
      ],
    });
    expect(doc.validateSync()).toBeDefined();
  });

  it('runs Group layout update casting and validators before the driver operation', async () => {
    const driverUpdate = jest
      .spyOn(PageModel.collection, 'findOneAndUpdate')
      .mockResolvedValue({ value: null } as never);
    const id = new mongoose.Types.ObjectId();

    try {
      await PageModel.findByIdAndUpdate(
        id,
        {
          $set: {
            blocks: [
              {
                id: 'g',
                type: 'group',
                layout: 'vertical',
                blocks: [htmlChild('c1')],
              },
            ],
          },
        },
        { new: true, runValidators: true },
      );
      expect(driverUpdate).toHaveBeenCalledTimes(1);

      driverUpdate.mockClear();
      await expect(
        PageModel.findByIdAndUpdate(
          id,
          {
            $set: {
              blocks: [
                {
                  id: 'g',
                  type: 'group',
                  layout: 'diagonal',
                  blocks: [htmlChild('c1')],
                },
              ],
            },
          },
          { new: true, runValidators: true },
        ),
      ).rejects.toThrow();
      expect(driverUpdate).not.toHaveBeenCalled();
    } finally {
      driverUpdate.mockRestore();
    }
  });

  it('drops a nested group child (group not registered on the child path)', () => {
    const doc = new PageModel({
      ...basePage,
      blocks: [
        {
          id: 'g',
          type: 'group',
          blocks: [{ id: 'nested', type: 'group', blocks: [htmlChild('c1')] }],
        },
      ],
    });

    // The nested-children base has no `group` discriminator. On this in-memory
    // `new Model(...)` path Mongoose silently drops the un-castable element; on
    // the real persisted write paths (`findByIdAndUpdate` for updates, `save()`
    // for creates) it instead throws a CastError. Either way a nested group is
    // not persistable (Joi rejects it first on the API), which is what this asserts.
    const group = doc.toObject().blocks[0] as Record<string, any>;
    expect(group.blocks).toHaveLength(0);
  });

  it('drops a hero child (hero not registered on the child path)', () => {
    const doc = new PageModel({
      ...basePage,
      blocks: [
        {
          id: 'g',
          type: 'group',
          blocks: [{ id: 'h', type: 'hero', items: [{ title: 'x' }] }],
        },
      ],
    });

    const group = doc.toObject().blocks[0] as Record<string, any>;
    expect(group.blocks).toHaveLength(0);
  });
});

describe('Group scope isolation (Mongoose, §9)', () => {
  it('does not persist a group block on an event (belt-and-braces)', () => {
    const doc = new EventModel({
      ...baseEvent,
      blocks: [{ id: 'g', type: 'group', blocks: [htmlChild('c1')] }],
    });

    // group is registered only on the isolated page-root base, never on the
    // shared base the event array uses → the group element is dropped.
    expect(doc.toObject().blocks).toHaveLength(0);
  });

  it('still accepts existing leaf blocks on an event', () => {
    const doc = new EventModel({
      ...baseEvent,
      blocks: [htmlChild('h1')],
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.toObject().blocks).toHaveLength(1);
  });
});

describe('Dynamic collection persistence limit', () => {
  it.each(['people', 'partners', 'events'])(
    '%s permits 100 and rejects 101 in Page, Group and Event blocks',
    (entityType) => {
      for (const limit of [100, 101]) {
        const block = {
          id: 'collection',
          type: 'entityCollection',
          source: 'dynamic',
          entityType,
          layout: 'grid',
          items: [],
          filters: {},
          limit,
        };
        for (const document of [
          new PageModel({ ...basePage, blocks: [block] }),
          new PageModel({
            ...basePage,
            blocks: [{ id: 'group', type: 'group', blocks: [block] }],
          }),
          new EventModel({ ...baseEvent, blocks: [block] }),
        ]) {
          if (limit === 100) expect(document.validateSync()).toBeUndefined();
          else expect(document.validateSync()?.message).toContain('100');
        }
      }
    },
  );
});

describe('EntityCollection columns persistence', () => {
  const collection = (columns?: unknown) => ({
    id: 'collection',
    type: 'entityCollection',
    entityType: 'people',
    layout: 'grid',
    items: ['507f1f77bcf86cd799439221'],
    ...(columns === undefined ? {} : { columns }),
  });

  it.each([undefined, 'auto', 2, 3, 4, 5])(
    'round-trips %p without changing its scalar type in Page, Group and Event blocks',
    (columns) => {
      const documents = [
        new PageModel({ ...basePage, blocks: [collection(columns)] }),
        new PageModel({
          ...basePage,
          blocks: [
            {
              id: 'group',
              type: 'group',
              blocks: [collection(columns)],
            },
          ],
        }),
        new EventModel({ ...baseEvent, blocks: [collection(columns)] }),
      ];

      for (const document of documents) {
        expect(document.validateSync()).toBeUndefined();
        const stored = document.toObject().blocks[0] as Record<string, any>;
        const storedCollection =
          stored.type === 'group' ? stored.blocks[0] : stored;
        expect(storedCollection.columns).toBe(columns);
        if (columns !== undefined) {
          expect(typeof storedCollection.columns).toBe(typeof columns);
        }
      }
    },
  );

  it.each([null, '', '2', 'Auto', 1, 6, 2.5, true, [], {}, NaN, Infinity])(
    'rejects invalid value %p in Page, Group and Event blocks',
    (columns) => {
      for (const document of [
        new PageModel({ ...basePage, blocks: [collection(columns)] }),
        new PageModel({
          ...basePage,
          blocks: [
            {
              id: 'group',
              type: 'group',
              blocks: [collection(columns)],
            },
          ],
        }),
        new EventModel({ ...baseEvent, blocks: [collection(columns)] }),
      ]) {
        expect(document.validateSync()).toBeDefined();
      }
    },
  );

  it('runs update casting and validators before the driver operation', async () => {
    const driverUpdate = jest
      .spyOn(PageModel.collection, 'findOneAndUpdate')
      .mockResolvedValue({ value: null } as never);
    const id = new mongoose.Types.ObjectId();

    try {
      await PageModel.findByIdAndUpdate(
        id,
        { $set: { blocks: [collection('auto')] } },
        { new: true, runValidators: true },
      );
      expect(driverUpdate).toHaveBeenCalledTimes(1);

      driverUpdate.mockClear();
      await expect(
        PageModel.findByIdAndUpdate(
          id,
          { $set: { blocks: [collection(null)] } },
          { new: true, runValidators: true },
        ),
      ).rejects.toThrow();
      expect(driverUpdate).not.toHaveBeenCalled();
    } finally {
      driverUpdate.mockRestore();
    }
  });

  it('keeps existing mixed Page content editable under update validators', async () => {
    const blocks = [
      { id: 'rich', type: 'richText', title: 'Rich text' },
      collection(),
      { id: 'hero', type: 'hero', items: [{ title: 'Hero card' }] },
      {
        id: 'cta',
        type: 'cta',
        buttons: [
          {
            label: 'Open',
            type: 'block',
            block: { id: 'modal', type: 'richText', title: 'Modal content' },
          },
        ],
      },
      {
        id: 'gallery',
        type: 'gallery',
        items: [{ mediaId: '507f1f77bcf86cd799439222' }],
      },
      {
        id: 'application',
        type: 'applicationForm',
        applicationType: 'general',
      },
      { id: 'html', type: 'html', content: '<p>Legacy template default</p>' },
      {
        id: 'group',
        type: 'group',
        blocks: [
          { id: 'group-html', type: 'html', content: '<p>Group child</p>' },
          { ...collection(), id: 'group-collection' },
        ],
      },
    ];
    const driverUpdate = jest
      .spyOn(PageModel.collection, 'findOneAndUpdate')
      .mockResolvedValue({ value: null } as never);
    const id = new mongoose.Types.ObjectId();

    try {
      await PageModel.findByIdAndUpdate(
        id,
        { $set: { blocks } },
        { new: true, runValidators: true },
      );
      expect(driverUpdate).toHaveBeenCalledTimes(1);

      const edited = structuredClone(blocks) as Array<Record<string, unknown>>;
      edited[0] = { ...edited[0], title: 'Edited rich text' };
      await PageModel.findByIdAndUpdate(
        id,
        { $set: { blocks: edited } },
        { new: true, runValidators: true },
      );
      expect(driverUpdate).toHaveBeenCalledTimes(2);
    } finally {
      driverUpdate.mockRestore();
    }
  });
});

describe('Hero optional presentation persistence', () => {
  it.each([2, 3, 4, 5])(
    'round-trips %i columns and hidden item data',
    (columns) => {
      const hero = {
        id: 'hero',
        type: 'hero',
        sectionSpacing: 'none',
        columns,
        items: [
          {
            title: 'Hidden',
            subtitle: 'Keep me',
            icon: 'Users',
            isVisible: false,
            button: {
              label: 'Details',
              type: 'block',
              block: {
                id: 'details',
                type: 'richText',
                description: '<p>Details</p>',
              },
            },
          },
          { title: 'Legacy visible' },
        ],
      };
      const doc = new PageModel({ ...basePage, blocks: [hero] });
      expect(doc.validateSync()).toBeUndefined();
      const reloaded = new PageModel(doc.toObject());
      expect(reloaded.validateSync()).toBeUndefined();
      expect(reloaded.toObject().blocks[0]).toMatchObject(hero);
      const event = new EventModel({ ...baseEvent, blocks: [hero] });
      expect(event.validateSync()).toBeUndefined();
      expect(event.toObject().blocks[0]).toMatchObject(hero);
    },
  );
  it.each([
    { columns: 1 },
    { columns: 6 },
    { columns: 2.5 },
    { sectionSpacing: 'huge' },
  ])('rejects invalid values %j', (settings) => {
    expect(
      new PageModel({
        ...basePage,
        blocks: [{ id: 'hero', type: 'hero', ...settings }],
      }).validateSync(),
    ).toBeDefined();
  });
  it('does not introduce settings on old content', () => {
    const stored = new PageModel({
      ...basePage,
      blocks: [{ id: 'old', type: 'hero', items: [{ title: 'Legacy' }] }],
    }).toObject().blocks[0] as Record<string, any>;
    expect(stored.sectionSpacing).toBeUndefined();
    expect(stored.columns).toBeUndefined();
    expect(stored.items[0].isVisible).toBeUndefined();
  });
});

it('persists optional Hero button arrays and hidden configuration without defaulting legacy arrays', () => {
  const button = {
    label: 'Link',
    type: 'external',
    url: 'https://example.com',
    isVisible: false,
  };
  const hero = {
    id: 'hero',
    type: 'hero',
    items: [
      { title: 'Legacy', button },
      { title: 'Many', buttons: [{ ...button, isVisible: true }, button] },
      { title: 'Empty', button, buttons: [] },
    ],
  };
  for (const doc of [
    new PageModel({ ...basePage, blocks: [hero] }),
    new EventModel({ ...baseEvent, blocks: [hero] }),
  ]) {
    expect(doc.validateSync()).toBeUndefined();
    const saved = JSON.parse(JSON.stringify(doc.toObject())).blocks[0];
    expect(saved).toMatchObject(hero);
    expect(saved.items[0].buttons).toBeUndefined();
    expect(saved.items[2].buttons).toEqual([]);
  }
});

describe('legacy Hero embedded media lookup indexes', () => {
  it.each([
    ['page', pageSchema],
    ['event', domainEventSchema],
  ] as const)(
    '%s indexes rich text and gallery media without a database connection',
    (_name, schema) => {
      for (const path of [
        'blocks.items.button.block.media.mediaId',
        'blocks.items.button.block.items.mediaId',
      ]) {
        expect(schema.indexes()).toEqual(
          expect.arrayContaining([
            [{ [path]: 1 }, expect.objectContaining({ sparse: true })],
          ]),
        );
      }
    },
  );
});
