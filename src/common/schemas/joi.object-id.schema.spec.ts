import { joiObjectId } from './joi.object-id.schema';

describe('joiObjectId', () => {
  it('accepts sentinel value "none"', () => {
    const { error, value } = joiObjectId.validate('none', {
      abortEarly: false,
    });

    expect(error).toBeUndefined();
    expect(value).toBe('none');
  });

  it('returns shared ObjectId message for non-hex input', () => {
    const { error } = joiObjectId.validate('not-an-objectid', {
      abortEarly: false,
    });

    expect(error).toBeDefined();
    expect(error?.details[0].message).toContain('must be a valid ObjectId');
  });

  it('returns shared ObjectId message for wrong length input', () => {
    const { error } = joiObjectId.validate('507f1f77bcf86cd7994390', {
      abortEarly: false,
    });

    expect(error).toBeDefined();
    expect(error?.details[0].message).toContain('must be a valid ObjectId');
  });

  it('rejects non-sentinel random string', () => {
    const { error } = joiObjectId.validate('foo', {
      abortEarly: false,
    });

    expect(error).toBeDefined();
    expect(error?.details[0].message).toContain('must be a valid ObjectId');
  });
});
