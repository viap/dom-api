import { createEventSchema } from './joi.create-event.schema';
import { updateEventSchema } from './joi.update-event.schema';
import {
  EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH,
  EVENT_SCHEDULE_MAX_DAYS,
} from '../types/event-schedule.interface';
import { normalizeEventSchedule } from '../utils/event-schedule';

describe('Event schedule validation', () => {
  const baseCreatePayload = {
    domainId: '507f1f77bcf86cd799439021',
    type: 'seminar',
    title: 'Event title',
    slug: 'event-title',
  };

  const legacyTiming = {
    startAt: '2026-04-20T10:00:00.000Z',
    endAt: '2026-04-20T12:00:00.000Z',
  };

  const schedule = {
    days: [
      {
        date: '2026-04-20',
        startTime: '14:00',
        endTime: '16:00',
        description: '  Opening day  ',
      },
      {
        date: '2026-04-22',
        startTime: '15:00',
        endTime: '17:00',
        description: '   ',
      },
    ],
  };

  it('keeps legacy create payloads legacy-only', () => {
    const { error, value } = createEventSchema.validate({
      ...baseCreatePayload,
      ...legacyTiming,
    });

    expect(error).toBeUndefined();
    expect(value).toEqual(
      expect.objectContaining({
        ...legacyTiming,
      }),
    );
    expect(value.schedule).toBeUndefined();
  });

  it('accepts schedule create payloads without legacy timing fields', () => {
    const { error, value } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule,
      registration: { deadline: '2026-04-20T10:00:00.000Z' },
    });

    expect(error).toBeUndefined();
    expect(value.schedule).toEqual({
      timezone: 'Asia/Tbilisi',
      days: [
        {
          date: '2026-04-20',
          startTime: '14:00',
          endTime: '16:00',
          description: 'Opening day',
        },
        {
          date: '2026-04-22',
          startTime: '15:00',
          endTime: '17:00',
        },
      ],
    });
    expect(value.startAt).toBeUndefined();
    expect(value.endAt).toBeUndefined();
  });

  it('derives the compatibility envelope from the schedule', () => {
    expect(normalizeEventSchedule(schedule)).toMatchObject({
      startAt: '2026-04-20T10:00:00.000Z',
      endAt: '2026-04-22T13:00:00.000Z',
    });
  });

  it('rejects schedule create payloads with legacy timing fields', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      ...legacyTiming,
      schedule,
    });

    expect(error).toBeDefined();
  });

  it('rejects schedule PATCH payloads with legacy timing fields', () => {
    const { error } = updateEventSchema.validate({
      ...legacyTiming,
      schedule,
    });

    expect(error).toBeDefined();
  });

  it('rejects legacy PATCH payloads with only one timing field', () => {
    const { error } = updateEventSchema.validate({
      startAt: '2026-04-20T10:00:00.000Z',
    });

    expect(error).toBeDefined();
  });

  it('allows paired legacy timing PATCH payloads during compatibility', () => {
    const { error } = updateEventSchema.validate(legacyTiming);

    expect(error).toBeUndefined();
  });

  it('rejects duplicate schedule dates', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule: {
        days: [
          { date: '2026-04-20', startTime: '14:00', endTime: '16:00' },
          { date: '2026-04-20', startTime: '15:00', endTime: '17:00' },
        ],
      },
    });

    expect(error).toBeDefined();
  });

  it('rejects invalid schedule dates and times', () => {
    const { error: invalidDateError } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule: {
        days: [{ date: '2026-02-30', startTime: '14:00', endTime: '16:00' }],
      },
    });
    const { error: invalidTimeError } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule: {
        days: [{ date: '2026-04-20', startTime: '24:00', endTime: '16:00' }],
      },
    });

    expect(invalidDateError).toBeDefined();
    expect(invalidTimeError).toBeDefined();
  });

  it('rejects empty days, unsorted days, and overnight day ranges', () => {
    const { error: emptyDaysError } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule: { days: [] },
    });
    const { error: unsortedDaysError } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule: {
        days: [
          { date: '2026-04-22', startTime: '14:00', endTime: '16:00' },
          { date: '2026-04-20', startTime: '14:00', endTime: '16:00' },
        ],
      },
    });
    const { error: overnightError } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule: {
        days: [{ date: '2026-04-20', startTime: '16:00', endTime: '14:00' }],
      },
    });

    expect(emptyDaysError).toBeDefined();
    expect(unsortedDaysError).toBeDefined();
    expect(overnightError).toBeDefined();
  });

  it('accepts non-contiguous schedule days', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule,
    });

    expect(error).toBeUndefined();
  });

  it('enforces schedule day count and description length limits', () => {
    const createDay = (index: number) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      startTime: '14:00',
      endTime: '16:00',
    });
    const boundarySchedule = {
      days: Array.from({ length: EVENT_SCHEDULE_MAX_DAYS }, (_, index) =>
        createDay(index)
      ),
    };
    const tooManyDaysSchedule = {
      days: Array.from({ length: EVENT_SCHEDULE_MAX_DAYS + 1 }, (_, index) =>
        createDay(index)
      ),
    };
    const tooLongDescriptionSchedule = {
      days: [
        {
          ...createDay(0),
          description: 'a'.repeat(
            EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH + 1
          ),
        },
      ],
    };

    expect(
      createEventSchema.validate({
        ...baseCreatePayload,
        schedule: boundarySchedule,
      }).error
    ).toBeUndefined();
    expect(
      createEventSchema.validate({
        ...baseCreatePayload,
        schedule: tooManyDaysSchedule,
      }).error
    ).toBeDefined();
    expect(
      updateEventSchema.validate({
        schedule: tooLongDescriptionSchedule,
      }).error
    ).toBeDefined();
  });

  it('rejects non-Tbilisi schedule timezones', () => {
    const { error } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule: {
        timezone: 'UTC',
        days: [{ date: '2026-04-20', startTime: '14:00', endTime: '16:00' }],
      },
    });

    expect(error).toBeDefined();
  });

  it('compares registration deadline against the first schedule start', () => {
    const { error: validError } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule,
      registration: { deadline: '2026-04-20T10:00:00.000Z' },
    });
    const { error: invalidError } = createEventSchema.validate({
      ...baseCreatePayload,
      schedule,
      registration: { deadline: '2026-04-20T10:00:01.000Z' },
    });

    expect(validError).toBeUndefined();
    expect(invalidError).toBeDefined();
  });
});
