import { DomainEventDocument } from '../schemas/domain-event.schema';
import { EventStatus } from '../enums/event-status.enum';
import {
  getEventNextTransitionAt,
  getRegistrationAvailability,
} from './event-policy';

const event = (overrides: Record<string, unknown> = {}) =>
  ({
    status: EventStatus.Active,
    startAt: '2026-11-13T08:00:00.000Z',
    endAt: '2026-11-13T10:00:00.000Z',
    registration: { isOpen: true },
    ...overrides,
  } as unknown as DomainEventDocument);

describe('shared Event registration policy', () => {
  const now = new Date('2026-11-13T09:00:00.000Z');

  it('uses deadline equality as closed and legacy lifecycle as active', () => {
    expect(
      getRegistrationAvailability({
        event: event({
          status: EventStatus.RegistrationOpen,
          registration: { isOpen: true, deadline: now.toISOString() },
        }),
        registeredCount: 0,
        now,
      }),
    ).toBe('closed');
  });

  it('fails closed for a malformed stored registration deadline', () => {
    expect(
      getRegistrationAvailability({
        event: event({
          registration: { isOpen: true, deadline: 'not-a-date' },
        }),
        registeredCount: 0,
        now,
      }),
    ).toBe('closed');
  });

  it('returns waitlist at or above capacity without rejecting applications', () => {
    expect(
      getRegistrationAvailability({
        event: event({ capacity: 10 }),
        registeredCount: 10,
        now,
      }),
    ).toBe('waitlist');
  });

  it('closes at the exact manual end boundary and for invalid capacity', () => {
    expect(
      getRegistrationAvailability({
        event: event(),
        registeredCount: 0,
        now: new Date('2026-11-13T10:00:00.000Z'),
      }),
    ).toBe('closed');
    expect(
      getRegistrationAvailability({
        event: event({ capacity: 0 }),
        registeredCount: 0,
        now,
      }),
    ).toBe('closed');
  });

  it('uses the valid transitional capacity while retaining the invalid warning', () => {
    expect(
      getRegistrationAvailability({
        event: event({
          capacity: 0,
          registration: { isOpen: true, maxParticipants: 10 },
        }),
        registeredCount: 10,
        now,
      }),
    ).toBe('waitlist');
  });

  it('schedules the next active recurring boundary beyond cancelled previews', () => {
    const cancelledDates = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 5 + index * 7));
      return date.toISOString().slice(0, 10);
    });
    expect(
      getEventNextTransitionAt(
        event({
          schedule: {
            timezone: 'Asia/Tbilisi',
            mode: 'recurring',
            recurrence: {
              unit: 'week',
              interval: 1,
              anchorDate: '2026-01-05',
              startTime: '18:00',
              endTime: '20:00',
            },
            cancelledDates,
            overrides: [],
            hasActiveOccurrences: true,
          },
        }),
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe('2026-03-30T14:00:00.000Z');
  });
});
