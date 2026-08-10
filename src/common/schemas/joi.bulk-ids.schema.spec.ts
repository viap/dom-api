import { bulkIdsSchema } from './joi.bulk-ids.schema';

describe('bulkIdsSchema', () => {
  it('should reject more than 100 ids', () => {
    const ids = Array.from({ length: 101 }, (_, index) =>
      `507f1f77bcf86cd79943${String(index).padStart(4, '0')}`.slice(0, 24),
    );

    const { error } = bulkIdsSchema.validate({ ids });

    expect(error).toBeDefined();
  });
});
