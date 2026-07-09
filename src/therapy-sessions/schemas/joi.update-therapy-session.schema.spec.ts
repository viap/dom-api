import { BadRequestException } from '@nestjs/common';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { joiUpdateTherapySessionSchema } from './joi.update-therapy-session.schema';

describe('joiUpdateTherapySessionSchema', () => {
  const pipe = new JoiValidationPipe(joiUpdateTherapySessionSchema);

  it('allows clearing a therapy request link with null', () => {
    expect(pipe.transform({ therapyRequest: null })).toEqual({
      therapyRequest: null,
    });
  });

  it('rejects invalid therapy request ids', () => {
    expect(() =>
      pipe.transform({ therapyRequest: 'not-an-object-id' }),
    ).toThrow(BadRequestException);
  });
});
