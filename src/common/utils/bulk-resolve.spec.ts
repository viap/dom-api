import { prepareBulkIds, toBulkResolveResponse } from './bulk-resolve';

describe('bulk-resolve utilities', () => {
  it('prepares unique valid ids while preserving first-seen order', () => {
    const result = prepareBulkIds([
      '507f1f77bcf86cd799439011',
      ' invalid ',
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
      'invalid',
    ]);

    expect(result.uniqueIds).toEqual([
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
    ]);
    expect(result.validIds).toEqual([
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
    ]);
  });

  it('builds ordered bulk response from valid ids only', () => {
    const prepared = prepareBulkIds([
      '507f1f77bcf86cd799439011',
      'bad-id',
      '507f1f77bcf86cd799439012',
    ]);

    const response = toBulkResolveResponse({
      preparedIds: prepared,
      items: [
        { _id: '507f1f77bcf86cd799439012', name: 'second' },
        { _id: '507f1f77bcf86cd799439011', name: 'first' },
      ],
      getId: (item) => item._id,
    });

    expect(response.items.map((item) => item._id)).toEqual([
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
    ]);
  });

  it('treats mixed-case object ids as the same id', () => {
    const result = prepareBulkIds([
      '507F1F77BCF86CD799439011',
      '507f1f77bcf86cd799439011',
    ]);

    expect(result.validIds).toEqual(['507f1f77bcf86cd799439011']);
    expect(result.uniqueIds).toEqual(['507F1F77BCF86CD799439011']);
  });

  it('returns no valid ids for all-invalid inputs', () => {
    const result = prepareBulkIds(['bad-id', 'still-bad', 'hello world!']);

    expect(result.validIds).toEqual([]);
    expect(result.uniqueIds).toEqual([]);
  });

  it('ignores duplicate _id values returned by storage', () => {
    const prepared = prepareBulkIds([
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
    ]);

    const response = toBulkResolveResponse({
      preparedIds: prepared,
      items: [
        { _id: '507f1f77bcf86cd799439011', label: 'first' },
        { _id: '507f1f77bcf86cd799439011', label: 'first duplicate' },
        { _id: '507f1f77bcf86cd799439012', label: 'second' },
      ],
      getId: (item) => item._id,
    });

    expect(response.items.map((item) => item.label)).toEqual([
      'first',
      'second',
    ]);
  });
});
