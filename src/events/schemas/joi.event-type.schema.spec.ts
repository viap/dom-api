import { EventType } from '../enums/event-type.enum';
import { createEventSchema } from './joi.create-event.schema';
import { updateEventSchema } from './joi.update-event.schema';

describe('Event type validation', () => {
  it('accepts group for create and update payloads', () => {
    const createResult = createEventSchema.validate({
      domainId: '507f1f77bcf86cd799439021',
      type: EventType.Group,
      title: 'Therapy group',
      slug: 'therapy-group',
      startAt: '2026-12-20T10:00:00.000Z',
      endAt: '2026-12-20T12:00:00.000Z',
    });
    const updateResult = updateEventSchema.validate({
      type: EventType.Group,
    });

    expect(createResult.error).toBeUndefined();
    expect(createResult.value.type).toBe(EventType.Group);
    expect(updateResult.error).toBeUndefined();
    expect(updateResult.value.type).toBe(EventType.Group);
  });
});
