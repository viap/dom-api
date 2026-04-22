import { createApplicationSchema } from './joi.create-application.schema';

describe('createApplicationSchema domainId behavior', () => {
  const validBasePayload = {
    formType: 'general',
    applicant: {
      name: 'Jane Doe',
      contacts: [{ network: 'telegram', username: 'jane', hidden: false }],
    },
    payload: {
      message: 'General request',
    },
  };

  it('accepts payload without domainId', () => {
    const { error } = createApplicationSchema.validate(validBasePayload);
    expect(error).toBeUndefined();
  });

  it('accepts payload with domainId', () => {
    const { error } = createApplicationSchema.validate({
      ...validBasePayload,
      domainId: '660900000000000000000099',
    });
    expect(error).toBeUndefined();
  });
});
