import { EventType } from '../enums/event-type.enum';
import { createEventSchema } from './joi.create-event.schema';
import { updateEventSchema } from './joi.update-event.schema';

describe('Event media zoom validation', () => {
  const mediaId = '507f1f77bcf86cd799439111';
  const create = {
    domainId: '507f1f77bcf86cd799439021',
    type: EventType.Seminar,
    title: 'Event',
    slug: 'event',
    startAt: '2026-12-20T10:00:00.000Z',
    endAt: '2026-12-20T12:00:00.000Z',
  };

  it.each([1, 1.05, 1.234, 3])('preserves %p', (mediaZoom) => {
    for (const result of [
      createEventSchema.validate({ ...create, mediaId, mediaZoom }),
      updateEventSchema.validate({ mediaId, mediaZoom }),
    ]) {
      expect(result.error).toBeUndefined();
      expect(result.value.mediaZoom).toBe(mediaZoom);
    }
  });

  it.each(
    [
      null,
      '',
      '1.5',
      true,
      false,
      {},
      [1.5],
      NaN,
      Infinity,
      -Infinity,
      -1,
      0,
      0.99,
      3.01,
      99,
    ].map((value) => [value]),
  )('normalizes %p', (mediaZoom) => {
    for (const result of [
      createEventSchema.validate({ ...create, mediaId, mediaZoom }),
      updateEventSchema.validate({ mediaId, mediaZoom }),
    ]) {
      expect(result.error).toBeUndefined();
      expect(result.value.mediaZoom).toBe(1);
    }
  });

  it('keeps absence and rejects unknown properties', () => {
    expect(createEventSchema.validate(create).value).not.toHaveProperty(
      'mediaZoom',
    );
    expect(updateEventSchema.validate({ mediaId }).value).not.toHaveProperty(
      'mediaZoom',
    );
    expect(
      updateEventSchema.validate({ mediaId, zoom: 2 }).error,
    ).toBeDefined();
  });
});
