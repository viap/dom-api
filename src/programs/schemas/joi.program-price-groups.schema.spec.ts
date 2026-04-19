import { createProgramSchema } from './joi.create-program.schema';
import { updateProgramSchema } from './joi.update-program.schema';

describe('Program Joi priceGroups validation', () => {
  const baseCreatePayload = {
    domainId: '507f1f77bcf86cd799439021',
    kind: 'school',
    title: 'Program title',
    slug: 'program-title',
    format: 'online',
  };

  it('accepts valid priceGroups with ISO deadline', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Regular',
          deadline: '2026-04-20T00:00:00.000Z',
          price: { currency: 'gel', value: 700 },
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('rejects non-ISO deadline in priceGroups', () => {
    const { error } = createProgramSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Regular',
          deadline: '20/04/2026',
          price: { currency: 'gel', value: 700 },
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects priceGroups item without price', () => {
    const { error } = updateProgramSchema.validate({
      priceGroups: [{ title: 'No price' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects legacy top-level price field', () => {
    const { error } = updateProgramSchema.validate({
      price: { currency: 'gel', value: 700 },
    });

    expect(error).toBeDefined();
  });
});
