import {
  EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH,
  EVENT_SCHEDULE_MAX_DAYS,
  EVENT_SCHEDULE_TIMEZONE,
  EventSchedule,
  EventScheduleDay,
} from '../types/event-schedule.interface';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface TimeParts {
  hour: number;
  minute: number;
}

export interface EventScheduleEnvelope {
  schedule: EventSchedule;
  startAt: string;
  endAt: string;
}

export class EventScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventScheduleValidationError';
  }
}

function parseDateParts(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const [, yearInput, monthInput, dayInput] = match;
  const year = Number(yearInput);
  const month = Number(monthInput);
  const day = Number(dayInput);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function parseTimeParts(value: string): TimeParts | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function getEventDateTimeParts(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZone: EVENT_SCHEDULE_TIMEZONE,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function getEventTimeZoneOffsetMs(date: Date): number {
  const parts = getEventDateTimeParts(date);
  const wallTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return wallTimeAsUtc - date.getTime();
}

function eventWallClockToUtcIsoString(date: string, time: string): string {
  const dateParts = parseDateParts(date);
  const timeParts = parseTimeParts(time);

  if (!dateParts || !timeParts) {
    throw new EventScheduleValidationError('Invalid schedule day date or time');
  }

  const wallTimeAsUtc = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    0,
    0,
  );
  const wallDate = new Date(wallTimeAsUtc);
  const utcMs = wallTimeAsUtc - getEventTimeZoneOffsetMs(wallDate);
  const result = new Date(utcMs);
  const resultParts = getEventDateTimeParts(result);

  const isRoundTripMatch =
    resultParts.year === dateParts.year &&
    resultParts.month === dateParts.month &&
    resultParts.day === dateParts.day &&
    resultParts.hour === timeParts.hour &&
    resultParts.minute === timeParts.minute;

  if (!isRoundTripMatch) {
    throw new EventScheduleValidationError('Invalid schedule wall-clock time');
  }

  return result.toISOString();
}

export function eventDateToUtcStartIsoString(date: string): string {
  return eventWallClockToUtcIsoString(date, '00:00');
}

function normalizeScheduleDay(day: unknown): EventScheduleDay {
  if (!day || typeof day !== 'object' || Array.isArray(day)) {
    throw new EventScheduleValidationError('Schedule day must be an object');
  }

  const value = day as Record<string, unknown>;
  const date = typeof value.date === 'string' ? value.date.trim() : '';
  const startTime =
    typeof value.startTime === 'string' ? value.startTime.trim() : '';
  const endTime = typeof value.endTime === 'string' ? value.endTime.trim() : '';

  if (!parseDateParts(date)) {
    throw new EventScheduleValidationError(
      'Schedule day date must be a real YYYY-MM-DD date',
    );
  }

  if (!parseTimeParts(startTime) || !parseTimeParts(endTime)) {
    throw new EventScheduleValidationError(
      'Schedule day times must be HH:mm values',
    );
  }

  if (startTime >= endTime) {
    throw new EventScheduleValidationError(
      'Schedule day endTime must be after startTime',
    );
  }

  const description =
    typeof value.description === 'string' ? value.description.trim() : '';

  if (description.length > EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH) {
    throw new EventScheduleValidationError(
      `Schedule day description must be at most ${EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH} characters`,
    );
  }

  return {
    date,
    startTime,
    endTime,
    ...(description ? { description } : {}),
  };
}

export function normalizeEventSchedule(input: unknown): EventScheduleEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new EventScheduleValidationError('Schedule must be an object');
  }

  const value = input as Record<string, unknown>;
  const timezone =
    value.timezone === undefined ? EVENT_SCHEDULE_TIMEZONE : value.timezone;

  if (timezone !== EVENT_SCHEDULE_TIMEZONE) {
    throw new EventScheduleValidationError(
      `Schedule timezone must be ${EVENT_SCHEDULE_TIMEZONE}`,
    );
  }

  if (!Array.isArray(value.days) || value.days.length === 0) {
    throw new EventScheduleValidationError(
      'Schedule days must include at least one day',
    );
  }

  if (value.days.length > EVENT_SCHEDULE_MAX_DAYS) {
    throw new EventScheduleValidationError(
      `Schedule days must include at most ${EVENT_SCHEDULE_MAX_DAYS} days`,
    );
  }

  const seenDates = new Set<string>();
  let previousDate = '';
  const days = value.days.map((day) => {
    const normalizedDay = normalizeScheduleDay(day);

    if (seenDates.has(normalizedDay.date)) {
      throw new EventScheduleValidationError(
        'Schedule days must not include duplicate dates',
      );
    }

    if (previousDate && normalizedDay.date < previousDate) {
      throw new EventScheduleValidationError(
        'Schedule days must be sorted chronologically',
      );
    }

    seenDates.add(normalizedDay.date);
    previousDate = normalizedDay.date;
    return normalizedDay;
  });

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  return {
    schedule: {
      timezone: EVENT_SCHEDULE_TIMEZONE,
      days,
    },
    startAt: eventWallClockToUtcIsoString(firstDay.date, firstDay.startTime),
    endAt: eventWallClockToUtcIsoString(lastDay.date, lastDay.endTime),
  };
}
