import { joiUpdateTherapyRequestSchema } from './joi.update-therapy-request.schema';

describe('joiUpdateTherapyRequestSchema', () => {
  it('accepts payload without optional user/psychologist ids', () => {
    const { error } = joiUpdateTherapyRequestSchema.validate({
      descr: 'Updated description',
    });

    expect(error).toBeUndefined();
  });

  it('accepts valid optional user/psychologist ids', () => {
    const { error } = joiUpdateTherapyRequestSchema.validate({
      user: '507f1f77bcf86cd799439011',
      psychologist: '507f1f77bcf86cd799439012',
    });

    expect(error).toBeUndefined();
  });

  it('rejects invalid optional user/psychologist ids', () => {
    const { error } = joiUpdateTherapyRequestSchema.validate({
      user: 'invalid-user',
      psychologist: 'invalid-psychologist',
    });

    expect(error).toBeDefined();
  });
});
