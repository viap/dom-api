import { entityCollectionPreviewSchema } from './joi.entity-collection-preview.schema';

const objectId = '507f1f77bcf86cd799439221';

describe('entityCollectionPreviewSchema', () => {
  it('accepts normalized empty filters and defaults the limit', () => {
    const { error, value } = entityCollectionPreviewSchema.validate({
      entityType: 'people',
      filters: {},
      contextDomainId: null,
    });

    expect(error).toBeUndefined();
    expect(value.limit).toBe(12);
  });

  it('rejects unnormalized empty selections and incomplete custom ranges', () => {
    for (const input of [
      { entityType: 'people', filters: { roles: [] }, contextDomainId: null },
      {
        entityType: 'events',
        filters: { temporal: { mode: 'custom' } },
        contextDomainId: objectId,
      },
    ]) {
      expect(entityCollectionPreviewSchema.validate(input).error).toBeDefined();
    }
  });

  it('accepts a one-sided custom event range', () => {
    const { error } = entityCollectionPreviewSchema.validate({
      entityType: 'events',
      filters: { temporal: { mode: 'custom', from: '2026-09-10' } },
      contextDomainId: objectId,
    });

    expect(error).toBeUndefined();
  });
});
