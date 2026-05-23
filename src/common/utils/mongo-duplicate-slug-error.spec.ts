import { isMongoDuplicateSlugError } from './mongo-duplicate-slug-error';

describe('isMongoDuplicateSlugError', () => {
  it('returns true for duplicate slug key errors', () => {
    expect(
      isMongoDuplicateSlugError({ code: 11000, keyPattern: { slug: 1 } }),
    ).toBe(true);
  });

  it('returns false for non-object values', () => {
    expect(isMongoDuplicateSlugError(null)).toBe(false);
    expect(isMongoDuplicateSlugError(undefined)).toBe(false);
    expect(isMongoDuplicateSlugError('error')).toBe(false);
    expect(isMongoDuplicateSlugError(11000)).toBe(false);
  });

  it('returns false when code is missing', () => {
    expect(isMongoDuplicateSlugError({ keyPattern: { slug: 1 } })).toBe(false);
  });

  it('returns false when code is not 11000', () => {
    expect(
      isMongoDuplicateSlugError({ code: 500, keyPattern: { slug: 1 } }),
    ).toBe(false);
  });

  it('returns false when slug key pattern is missing', () => {
    expect(isMongoDuplicateSlugError({ code: 11000, keyPattern: {} })).toBe(
      false,
    );
  });
});
