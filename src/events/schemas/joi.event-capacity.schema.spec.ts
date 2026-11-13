import { createEventSchema } from './joi.create-event.schema';
import { updateEventSchema } from './joi.update-event.schema';

const baseCreatePayload = {
  domainId: '507f1f77bcf86cd799439021',
  type: 'seminar',
  title: 'Event title',
  slug: 'event-title',
  startAt: '2026-12-20T10:00:00.000Z',
  endAt: '2026-12-20T12:00:00.000Z',
};

describe('Event create capacity validation', () => {
  it('keeps each compatibility shape valid in isolation', () => {
    expect(
      createEventSchema.validate({ ...baseCreatePayload, capacity: 10 }).error,
    ).toBeUndefined();
    expect(
      createEventSchema.validate({
        ...baseCreatePayload,
        registration: { isOpen: true, maxParticipants: 10 },
      }).error,
    ).toBeUndefined();
  });

  it('canonicalizes equal duplicate fields and rejects conflicting create values', () => {
    const equal = createEventSchema.validate({
      ...baseCreatePayload,
      capacity: 10,
      registration: { isOpen: true, maxParticipants: 10 },
    });
    expect(equal.error).toBeUndefined();
    expect(equal.value).toMatchObject({
      capacity: 10,
      registration: { isOpen: true },
    });
    expect(equal.value.registration.maxParticipants).toBeUndefined();

    const conflict = createEventSchema.validate({
      ...baseCreatePayload,
      capacity: 10,
      registration: { isOpen: true, maxParticipants: 20 },
    });
    expect(conflict.error?.details[0]?.message).toBe(
      'capacity and registration.maxParticipants must match',
    );
  });
});

describe('Event update capacity mutation validation', () => {
  it('reports a dedicated missing-revision error', () => {
    const result = updateEventSchema.validate({
      capacityMutation: { action: 'set', value: 10 },
    });

    expect(result.error?.details[0]?.message).toBe(
      'capacityMutation requires expectedRevision',
    );
  });

  it('reports a dedicated missing-conflict error for use_legacy', () => {
    const result = updateEventSchema.validate({
      expectedRevision: 3,
      capacityMutation: { action: 'use_legacy' },
    });

    expect(result.error?.details[0]?.message).toBe(
      'capacityMutation.use_legacy requires expectedConflict',
    );
  });
});
