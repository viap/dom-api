import { createEventSchema } from './joi.create-event.schema';
import { updateEventSchema } from './joi.update-event.schema';

describe('Event Joi priceGroups validation', () => {
  const baseCreatePayload = {
    domainId: '507f1f77bcf86cd799439021',
    type: 'seminar',
    title: 'Event title',
    slug: 'event-title',
    startAt: 1776038400000,
    endAt: 1776045600000,
  };

  it('accepts valid priceGroups with ISO deadline', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Early bird',
          deadline: '2026-04-20T00:00:00.000Z',
          price: { currency: 'gel', value: 100 },
        },
      ],
    });

    expect(error).toBeUndefined();
  });

  it('rejects non-ISO deadline in priceGroups', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Early bird',
          deadline: '20-04-2026',
          price: { currency: 'gel', value: 100 },
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects priceGroups item without price', () => {
    const { error } = updateEventSchema.validate({
      priceGroups: [{ title: 'No price' }],
    });

    expect(error).toBeDefined();
  });

  it('rejects legacy top-level price field', () => {
    const { error } = updateEventSchema.validate({
      price: { currency: 'gel', value: 100 },
    });

    expect(error).toBeDefined();
  });
});
