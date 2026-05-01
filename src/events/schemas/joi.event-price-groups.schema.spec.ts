import { createEventSchema } from './joi.create-event.schema';
import { updateEventSchema } from './joi.update-event.schema';

describe('Event Joi priceGroups validation', () => {
  const baseCreatePayload = {
    domainId: '507f1f77bcf86cd799439021',
    type: 'seminar',
    title: 'Event title',
    slug: 'event-title',
    startAt: '2026-04-20T10:00:00.000Z',
    endAt: '2026-04-20T12:00:00.000Z',
  };

  it('accepts UTC ISO datetime fields', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      mediaId: '507f1f77bcf86cd799439099',
      registration: { deadline: '2026-04-20T08:00:00.000Z' },
    });

    expect(error).toBeUndefined();
  });

  it('rejects invalid mediaId in create payload', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      mediaId: 'not-an-object-id',
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid mediaId in update payload', () => {
    const { error } = updateEventSchema.validate({
      mediaId: 'not-an-object-id',
    });

    expect(error).toBeDefined();
  });

  it('rejects numeric datetime fields', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      startAt: 1776038400000,
      endAt: 1776045600000,
      registration: { deadline: 1776031200000 },
    });

    expect(error).toBeDefined();
  });

  it('rejects numeric datetime fields in update payload', () => {
    const { error } = updateEventSchema.validate({
      startAt: 1776038400000,
      endAt: 1776045600000,
      registration: { deadline: 1776031200000 },
    });

    expect(error).toBeDefined();
  });

  it('rejects semantically invalid datetime fields', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      startAt: '2026-02-30T10:00:00.000Z',
      endAt: '2026-04-20T12:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('rejects offset datetime fields', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      startAt: '2026-04-20T10:00:00.000+04:00',
      endAt: '2026-04-20T12:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('rejects date-only datetime fields', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      startAt: '2026-04-20',
      endAt: '2026-04-20T12:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('rejects empty datetime fields', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      startAt: '',
      endAt: '2026-04-20T12:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

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

  it('rejects date-only deadline in priceGroups', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Early bird',
          deadline: '2026-04-20',
          price: { currency: 'gel', value: 100 },
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects semantically invalid deadline in priceGroups', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      priceGroups: [
        {
          title: 'Early bird',
          deadline: '2026-02-30T00:00:00.000Z',
          price: { currency: 'gel', value: 100 },
        },
      ],
    });

    expect(error).toBeDefined();
  });

  it('rejects endAt earlier than startAt', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      startAt: '2026-04-20T12:00:00.000Z',
      endAt: '2026-04-20T10:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('rejects registration deadline after startAt', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      registration: { deadline: '2026-04-20T11:00:00.000Z' },
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
