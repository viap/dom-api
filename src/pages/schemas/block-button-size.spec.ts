import mongoose from 'mongoose';
import { ComponentSize } from '@/common/enums/component-size.enum';
import { createEventSchema } from '@/events/schemas/joi.create-event.schema';
import { updateEventSchema } from '@/events/schemas/joi.update-event.schema';
import { domainEventSchema } from '@/events/schemas/domain-event.schema';
import { createPageSchema } from './joi.create-page.schema';
import { updatePageSchema } from './joi.update-page.schema';
import { pageSchema } from './page.schema';
import {
  prepareBlocksForWrite,
  toPublicBlocks,
} from '@/pages/utils/block-validation';
import type { PageRootBlock } from '@/pages/types/page-block.interface';

const page = { title: 'Sizes', slug: 'sizes' };
const event = {
  ...page,
  domainId: '507f1f77bcf86cd799439221',
  type: 'seminar',
  startAt: '2026-11-01T10:00:00.000Z',
  endAt: '2026-11-01T12:00:00.000Z',
};
const PageModel = mongoose.model('ButtonSizePageTest', pageSchema);
const EventModel = mongoose.model('ButtonSizeEventTest', domainEventSchema);

function fixtures(size: unknown, includeGroup = true) {
  const button = {
    label: 'Sized action',
    type: 'external',
    url: 'https://example.com',
    ...(size !== undefined ? { size } : {}),
  };
  const leaves = [
    { id: 'text', type: 'richText', buttons: [button] },
    { id: 'cta', type: 'cta', buttons: [button] },
    {
      id: 'custom',
      type: 'entityCollection',
      entityType: 'custom',
      layout: 'grid',
      items: [],
      customItems: [{ title: 'Card', button }],
    },
    {
      id: 'html',
      type: 'html',
      template: 'vertical',
      content:
        '<span data-dom-html-snippet="button" data-dom-html-snippet-id="sized"></span>',
      snippets: [{ id: 'sized', type: 'button', button }],
    },
  ];
  return [
    ...leaves,
    {
      id: 'hero',
      type: 'hero',
      items: [
        { title: 'Legacy', button },
        { title: 'Array', buttons: [button] },
      ],
    },
    ...(includeGroup
      ? [
          {
            id: 'group',
            type: 'group',
            blocks: leaves.map((leaf) => ({ ...leaf, id: `group-${leaf.id}` })),
          },
        ]
      : []),
    ...leaves.map((leaf) => ({
      id: `modal-${leaf.id}`,
      type: 'cta',
      buttons: [
        {
          label: 'Open',
          type: 'block',
          block: leaf,
          ...(size !== undefined ? { size } : {}),
        },
      ],
    })),
  ];
}

function buttons(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  return [
    ...(node.type === 'external' || node.type === 'block' ? [node] : []),
    ...Object.values(node).flatMap(buttons),
  ];
}

describe('BlockButton size across page/event contracts', () => {
  const contracts = [
    { name: 'create page', schema: createPageSchema, base: page },
    { name: 'update page', schema: updatePageSchema, base: {} },
    { name: 'create event', schema: createEventSchema, base: event },
    { name: 'update event', schema: updateEventSchema, base: {} },
  ];

  describe.each(contracts)('$name', ({ name, schema, base }) => {
    it.each([undefined, ...Object.values(ComponentSize)])(
      'retains %s at every button location',
      (size) => {
        const { value, error } = schema.validate({
          ...base,
          blocks: fixtures(size, name.endsWith('page')),
        });
        expect(error).toBeUndefined();
        expect(buttons(value.blocks)).toHaveLength(
          name.endsWith('page') ? 18 : 14,
        );
        for (const button of buttons(value.blocks)) {
          expect(button.size).toBe(size);
          expect(Object.prototype.hasOwnProperty.call(button, 'size')).toBe(
            size !== undefined,
          );
        }
      },
    );

    it.each([null, '', 'medium', 'MD', ' md ', 1, true, [], {}])(
      'rejects invalid size %j including restricted modal content',
      (size) => {
        for (const block of fixtures(size, name.endsWith('page'))) {
          expect(
            schema.validate({ ...base, blocks: [block] }).error,
          ).toBeDefined();
        }
      },
    );
  });

  it.each([undefined, ...Object.values(ComponentSize)])(
    'persists and hydrates %s without adding defaults',
    (size) => {
      for (const doc of [
        new PageModel({ ...page, blocks: fixtures(size) }),
        new EventModel({ ...event, blocks: fixtures(size, false) }),
      ]) {
        expect(doc.validateSync()).toBeUndefined();
        const stored = doc.toObject();
        const hydrated =
          doc instanceof PageModel
            ? PageModel.hydrate(stored)
            : EventModel.hydrate(stored);
        expect(buttons(hydrated.toObject().blocks)).toHaveLength(
          doc instanceof PageModel ? 18 : 14,
        );
        for (const button of buttons(hydrated.toObject().blocks)) {
          expect(button.size).toBe(size);
          expect(Object.prototype.hasOwnProperty.call(button, 'size')).toBe(
            size !== undefined,
          );
        }
      }
    },
  );

  it('Mongoose rejects unsupported sizes on typed button paths', () => {
    for (const block of fixtures('unsupported', false).slice(0, 5)) {
      expect(
        new PageModel({ ...page, blocks: [block] }).validateSync(),
      ).toBeDefined();
      expect(
        new EventModel({ ...event, blocks: [block] }).validateSync(),
      ).toBeDefined();
    }
  });

  it.each([undefined, ...Object.values(ComponentSize)])(
    'preserves %s through write preparation and public conversion',
    async (size) => {
      const existingIds = async (ids: string[]) => new Set(ids);
      const prepared = await prepareBlocksForWrite(
        fixtures(size) as unknown as PageRootBlock[],
        {
          peopleExistingIds: existingIds,
          partnersExistingIds: existingIds,
          eventsExistingIds: existingIds,
          mediaExistingPublishedIds: existingIds,
          pagesExistingIds: existingIds,
          domainsGetActiveById: async () => ({}),
        },
      );
      const result = await toPublicBlocks(
        prepared as unknown as Record<string, unknown>[],
        {
          findPublishedPeopleSummariesByIds: async () => [],
          findDynamicPeopleSummaries: async () => [],
          findDynamicPartnerSummaries: async () => [],
          findDynamicEventSummaries: async () => [],
        },
        {
          owner: { kind: 'page', pageId: event.domainId },
          domainId: event.domainId,
          now: new Date('2026-10-20T00:00:00Z'),
        },
      );
      expect(buttons(result)).toHaveLength(18);
      for (const button of buttons(result)) {
        expect(button.size).toBe(size);
        expect(Object.prototype.hasOwnProperty.call(button, 'size')).toBe(
          size !== undefined,
        );
      }
    },
  );
});
