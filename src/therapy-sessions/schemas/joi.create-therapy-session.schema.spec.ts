import { joiCreateTherapySessionSchema } from './joi.create-therapy-session.schema';

describe('joiCreateTherapySessionSchema', () => {
  const basePayload = {
    dateTime: Date.now(),
    duration: 60,
    price: { currency: 'gel', value: 100 },
  };

  it('accepts valid ObjectId client and psychologist values', () => {
    const { error } = joiCreateTherapySessionSchema.validate({
      ...basePayload,
      client: '507f1f77bcf86cd799439011',
      psychologist: '507f1f77bcf86cd799439012',
    });

    expect(error).toBeUndefined();
  });

  it('rejects invalid client ObjectId', () => {
    const { error } = joiCreateTherapySessionSchema.validate({
      ...basePayload,
      client: 'invalid-client',
      psychologist: '507f1f77bcf86cd799439012',
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid psychologist ObjectId', () => {
    const { error } = joiCreateTherapySessionSchema.validate({
      ...basePayload,
      client: '507f1f77bcf86cd799439011',
      psychologist: 'invalid-psychologist',
    });

    expect(error).toBeDefined();
  });
});
