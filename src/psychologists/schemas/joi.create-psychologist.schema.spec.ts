import { joiCreatePsychologistSchema } from './joi.create-psychologist.schema';

describe('joiCreatePsychologistSchema', () => {
  it('accepts a valid ObjectId userId', () => {
    const { error } = joiCreatePsychologistSchema.validate({
      userId: '507f1f77bcf86cd799439011',
    });

    expect(error).toBeUndefined();
  });

  it('rejects an invalid userId', () => {
    const { error } = joiCreatePsychologistSchema.validate({
      userId: 'invalid-id',
    });

    expect(error).toBeDefined();
  });
});
