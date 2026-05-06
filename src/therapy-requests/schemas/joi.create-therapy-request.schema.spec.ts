import { joiCreateTherapyRequestSchema } from './joi.create-therapy-request.schema';

describe('joiCreateTherapyRequestSchema', () => {
  const basePayload = {
    name: 'Client name',
    descr: 'Request description',
    contacts: [{ network: 'telegram', username: '@client' }],
  };

  it('accepts payload without optional user/psychologist ids', () => {
    const { error } = joiCreateTherapyRequestSchema.validate(basePayload);

    expect(error).toBeUndefined();
  });

  it('accepts valid optional user/psychologist ids', () => {
    const { error } = joiCreateTherapyRequestSchema.validate({
      ...basePayload,
      user: '507f1f77bcf86cd799439011',
      psychologist: '507f1f77bcf86cd799439012',
    });

    expect(error).toBeUndefined();
  });

  it('rejects invalid optional user/psychologist ids', () => {
    const { error } = joiCreateTherapyRequestSchema.validate({
      ...basePayload,
      user: 'invalid-user',
      psychologist: 'invalid-psychologist',
    });

    expect(error).toBeDefined();
  });
});
