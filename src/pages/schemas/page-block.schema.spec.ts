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
