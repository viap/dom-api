import { createPersonSchema } from './joi.create-person.schema';
import { updatePersonSchema } from './joi.update-person.schema';

describe('Person services Joi validation', () => {
  const validService = {
    title: 'Individual therapy',
    prices: [{ currency: 'gel', value: 120 }],
  };

  it('accepts valid services payloads', () => {
    const createValidation = createPersonSchema.validate({
      slug: 'jane-doe',
      fullName: 'Jane Doe',
      services: [validService],
    });
    expect(createValidation.error).toBeUndefined();

    const updateValidation = updatePersonSchema.validate({
      services: [
        {
          title: 'Couples therapy',
          prices: [{ currency: 'usd', value: 90 }],
        },
      ],
    });
    expect(updateValidation.error).toBeUndefined();
  });

  it('defaults services to empty array on create', () => {
    const { error, value } = createPersonSchema.validate({
      slug: 'jane-doe',
      fullName: 'Jane Doe',
    });

    expect(error).toBeUndefined();
    expect(value.services).toEqual([]);
  });

  it('rejects legacy Prices key casing', () => {
    const { error } = createPersonSchema.validate({
      slug: 'jane-doe',
      fullName: 'Jane Doe',
      services: [
        {
          title: 'Legacy price casing',
          Prices: [{ currency: 'gel', value: 100 }],
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects too many services', () => {
    const services = Array.from({ length: 11 }, (_, index) => ({
      title: `Service ${index + 1}`,
      prices: [{ currency: 'gel', value: 100 }],
    }));

    const { error } = updatePersonSchema.validate({ services });
    expect(error).toBeDefined();
  });

  it('rejects empty prices arrays', () => {
    const { error } = createPersonSchema.validate({
      slug: 'jane-doe',
      fullName: 'Jane Doe',
      services: [{ title: 'Service', prices: [] }],
    });

    expect(error).toBeDefined();
  });

  it('rejects too many prices per service', () => {
    const prices = Array.from({ length: 6 }, (_, index) => ({
      currency: 'gel',
      value: 100 + index,
    }));

    const { error } = updatePersonSchema.validate({
      services: [{ title: 'Service', prices }],
    });

    expect(error).toBeDefined();
  });

  it('rejects blank or over-limit service titles', () => {
    const blankTitle = updatePersonSchema.validate({
      services: [{ title: '   ', prices: [{ currency: 'gel', value: 100 }] }],
    });
    expect(blankTitle.error).toBeDefined();

    const longTitle = updatePersonSchema.validate({
      services: [
        {
          title: 'a'.repeat(101),
          prices: [{ currency: 'gel', value: 100 }],
        },
      ],
    });
    expect(longTitle.error).toBeDefined();
  });
});
