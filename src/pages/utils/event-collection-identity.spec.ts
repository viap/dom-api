import { BadRequestException } from '@nestjs/common';
import { EntityCollectionEntityType } from '../enums/entity-collection-entity-type.enum';
import { PageBlockType } from '../enums/page-block-type.enum';
import { PageRootBlock } from '../types/page-block.interface';
import {
  assertUniqueEventCollectionIdentities,
  collectStoredEventCollections,
  collectionIdentityKey,
} from './event-collection-identity';

const collection = (id: string): PageRootBlock =>
  ({
    id,
    type: PageBlockType.EntityCollection,
    entityType: EntityCollectionEntityType.Events,
    source: 'manual',
    items: [],
  } as PageRootBlock);

describe('canonical Event collection identity', () => {
  it('keeps equal leaf ids under different ancestors distinct', () => {
    const blocks = [
      {
        id: 'group-a',
        type: PageBlockType.Group,
        blocks: [collection('events')],
      },
      {
        id: 'group-b',
        type: PageBlockType.Group,
        blocks: [collection('events')],
      },
    ] as PageRootBlock[];

    const identities = collectStoredEventCollections('PAGE-ID', blocks).map(
      ({ identity }) => identity,
    );
    expect(identities.map((identity) => identity.blockPath)).toEqual([
      ['group-a', 'events'],
      ['group-b', 'events'],
    ]);
    expect(collectionIdentityKey(identities[0])).not.toBe(
      collectionIdentityKey(identities[1]),
    );
    expect(collectionIdentityKey(identities[0])).toContain('page-id');
  });

  it('rejects an exact duplicate owner and full path', () => {
    const blocks = [
      {
        id: 'group',
        type: PageBlockType.Group,
        blocks: [collection('events'), collection('events')],
      },
    ] as PageRootBlock[];

    expect(() =>
      assertUniqueEventCollectionIdentities('page-id', blocks),
    ).toThrow(BadRequestException);
  });

  it('ignores Event collections embedded in hidden Hero items', () => {
    const blocks = [
      {
        id: 'hero',
        type: PageBlockType.Hero,
        items: [
          {
            title: 'Hidden',
            isVisible: false,
            button: {
              id: 'hidden-button',
              type: 'modal',
              isVisible: true,
              block: collection('hidden-events'),
            },
          },
          {
            title: 'Visible',
            isVisible: true,
            button: {
              id: 'visible-button',
              type: 'modal',
              isVisible: true,
              block: collection('visible-events'),
            },
          },
        ],
      },
    ] as unknown as PageRootBlock[];

    expect(
      collectStoredEventCollections('page-id', blocks).map(
        ({ identity }) => identity.blockPath,
      ),
    ).toEqual([['hero', 'visible-events']]);
  });
});
