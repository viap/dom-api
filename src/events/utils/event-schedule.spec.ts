import { EventStatus } from '../enums/event-status.enum';
import {
  addEventCalendarDays,
  hasActiveOccurrenceInRange,
  normalizeEventSchedule,
  projectEventScheduleForRead,
} from './event-schedule';

const recurring = (overrides: Record<string, unknown> = {}) => ({
  timezone: 'Asia/Tbilisi',
  mode: 'recurring',
  recurrence: {
    unit: 'week',
    interval: 1,
    anchorDate: '2026-01-05',
    startTime: '18:00',
    endTime: '20:00',
  },
  cancelledDates: [],
  overrides: [],
  ...overrides,
});

describe('recurring event schedule generator', () => {
  it('keeps weekly and biweekly cadence in calendar dates', () => {
    expect(addEventCalendarDays('2026-01-05', 7)).toBe('2026-01-12');
    const envelope = normalizeEventSchedule(
      recurring({
        recurrence: {
          unit: 'week',
          interval: 2,
          anchorDate: '2026-01-05',
          startTime: '18:00',
          endTime: '20:00',
          endDate: '2026-02-02',
        },
      }),
    );
    const read = projectEventScheduleForRead(
      envelope.schedule,
      EventStatus.Planned,
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(read?.mode).toBe('recurring');
    if (read?.mode !== 'recurring') return;
    expect(read.occurrencePreview.map((item) => item.date)).toEqual([
      '2026-01-05',
      '2026-01-19',
      '2026-02-02',
    ]);
  });

  it('finds the thirteenth active occurrence independently of the preview', () => {
    const cancelledDates = Array.from({ length: 12 }, (_, index) =>
      addEventCalendarDays('2026-01-05', index * 7),
    );
    const envelope = normalizeEventSchedule(recurring({ cancelledDates }));
    const read = projectEventScheduleForRead(
      envelope.schedule,
      EventStatus.Planned,
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(read?.mode).toBe('recurring');
    if (read?.mode !== 'recurring') return;
    expect(read.occurrencePreview).toHaveLength(12);
    expect(
      read.occurrencePreview.every((item) => item.status === 'cancelled'),
    ).toBe(true);
    expect(read.nextActiveOccurrence?.date).toBe('2026-03-30');
  });

  it('preserves an override under cancellation and restores it unchanged', () => {
    const input = recurring({
      cancelledDates: ['2026-01-12'],
      overrides: [
        {
          date: '2026-01-12',
          startTime: '19:00',
          endTime: '21:00',
          description: 'Changed',
        },
      ],
    });
    const stored = normalizeEventSchedule(input).schedule;
    const restored = normalizeEventSchedule({
      ...stored,
      cancelledDates: [],
    }).schedule;
    const read = projectEventScheduleForRead(
      restored,
      EventStatus.Planned,
      new Date('2026-01-10T00:00:00.000Z'),
    );
    expect(read?.mode).toBe('recurring');
    if (read?.mode !== 'recurring') return;
    expect(read.nextActiveOccurrence).toMatchObject({
      date: '2026-01-12',
      startTime: '19:00',
      endTime: '21:00',
      description: 'Changed',
    });
  });

  it('represents a finite all-cancelled series without legacy active dates', () => {
    const envelope = normalizeEventSchedule(
      recurring({
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-01-05',
          startTime: '18:00',
          endTime: '20:00',
          endDate: '2026-01-19',
        },
        cancelledDates: ['2026-01-05', '2026-01-12', '2026-01-19'],
      }),
    );
    const read = projectEventScheduleForRead(
      envelope.schedule,
      EventStatus.Planned,
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(read?.mode).toBe('recurring');
    if (read?.mode !== 'recurring') return;
    expect(read.hasActiveOccurrences).toBe(false);
    expect(read.days).toEqual([]);
    expect(read.nextActiveOccurrence).toBeNull();
    expect(read.lastActiveOccurrence).toBeNull();
    expect(read.occurrencePreview.at(-1)).toMatchObject({
      date: '2026-01-19',
      status: 'cancelled',
    });
    expect(envelope.startAt).toBe('2026-01-05T14:00:00.000Z');
    expect(envelope.endAt).toBe('2026-01-05T16:00:00.000Z');
  });

  it('applies exact one-sided custom ranges after cancellations', () => {
    const schedule = normalizeEventSchedule(
      recurring({ cancelledDates: ['2026-01-12'] }),
    ).schedule;
    expect(
      hasActiveOccurrenceInRange(
        schedule,
        EventStatus.Planned,
        '2026-01-12',
        '2026-01-12',
      ),
    ).toBe(false);
    expect(
      hasActiveOccurrenceInRange(schedule, EventStatus.Planned, '2026-01-12'),
    ).toBe(true);
    expect(
      hasActiveOccurrenceInRange(
        schedule,
        EventStatus.Planned,
        undefined,
        '2026-01-05',
      ),
    ).toBe(true);
  });

  it('rejects out-of-cadence and after-end exceptions', () => {
    expect(() =>
      normalizeEventSchedule(recurring({ cancelledDates: ['2026-01-06'] })),
    ).toThrow('cadence');
    expect(() =>
      normalizeEventSchedule(
        recurring({
          recurrence: {
            unit: 'week',
            interval: 1,
            anchorDate: '2026-01-05',
            startTime: '18:00',
            endTime: '20:00',
            endDate: '2026-01-12',
          },
          overrides: [{ date: '2026-01-19', description: 'Too late' }],
        }),
      ),
    ).toThrow('endDate');
  });

  it('accepts 366 exceptions and rejects the 367th', () => {
    const dates = Array.from({ length: 367 }, (_, index) =>
      addEventCalendarDays('2026-01-05', index * 7),
    );
    expect(() =>
      normalizeEventSchedule(
        recurring({ cancelledDates: dates.slice(0, 366) }),
      ),
    ).not.toThrow();
    expect(() =>
      normalizeEventSchedule(recurring({ cancelledDates: dates })),
    ).toThrow('at most 366');
  });
});
