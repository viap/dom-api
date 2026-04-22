import { joiObjectId } from './joi.object-id.schema';

describe('joiObjectId', () => {
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
});
