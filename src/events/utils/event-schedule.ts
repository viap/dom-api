import { EventStatus } from '../enums/event-status.enum';
import {
  EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH,
  EVENT_SCHEDULE_MAX_DAYS,
  EVENT_SCHEDULE_MAX_EXCEPTIONS,
  EVENT_SCHEDULE_PREVIEW_LIMIT,
  EVENT_SCHEDULE_TIMEZONE,
  EventRecurrenceRule,
  EventScheduleDay,
  EventScheduleOverride,
  EventScheduleRead,
  EventScheduleStored,
  EventScheduleWrite,
  ManualEventSchedule,
  RecurringEventScheduleRead,
  RecurringEventScheduleStored,
  RecurringOccurrenceRead,
} from '../types/event-schedule.interface';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

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
  schedule: EventScheduleStored;
  startAt: string;
  endAt: string;
}

export class EventScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventScheduleValidationError';
  }
}

export function parseEventDate(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

function parseTimeParts(value: string): TimeParts | null {
  const match = TIME_PATTERN.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

function dateToDayNumber(date: string): number {
  const parts = parseEventDate(date);
  if (!parts) {
    throw new EventScheduleValidationError(
      'Schedule date must be a real YYYY-MM-DD date',
    );
  }
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS;
}

export function addEventCalendarDays(date: string, days: number): string {
  return new Date((dateToDayNumber(date) + days) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function eventCalendarDayDifference(from: string, to: string): number {
  return dateToDayNumber(to) - dateToDayNumber(from);
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

export function eventDateTimeToLocalKey(date: Date): {
  date: string;
  time: string;
} {
  const parts = getEventDateTimeParts(date);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

function getEventTimeZoneOffsetMs(date: Date): number {
  const parts = getEventDateTimeParts(date);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - date.getTime()
  );
}

export function eventWallClockToUtcIsoString(
  date: string,
  time: string,
): string {
  const dateParts = parseEventDate(date);
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
  );
  const result = new Date(
    wallTimeAsUtc - getEventTimeZoneOffsetMs(new Date(wallTimeAsUtc)),
  );
  const resultParts = getEventDateTimeParts(result);
  if (
    resultParts.year !== dateParts.year ||
    resultParts.month !== dateParts.month ||
    resultParts.day !== dateParts.day ||
    resultParts.hour !== timeParts.hour ||
    resultParts.minute !== timeParts.minute
  ) {
    throw new EventScheduleValidationError('Invalid schedule wall-clock time');
  }
  return result.toISOString();
}

export function eventDateToUtcStartIsoString(date: string): string {
  return eventWallClockToUtcIsoString(date, '00:00');
}

function normalizeDescription(value: unknown): string | undefined {
  const description = typeof value === 'string' ? value.trim() : '';
  if (description.length > EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH) {
    throw new EventScheduleValidationError(
      `Schedule day description must be at most ${EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH} characters`,
    );
  }
  return description || undefined;
}

function assertTimes(startTime: string, endTime: string): void {
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
  if (!parseEventDate(date)) {
    throw new EventScheduleValidationError(
      'Schedule day date must be a real YYYY-MM-DD date',
    );
  }
  assertTimes(startTime, endTime);
  const description = normalizeDescription(value.description);
  return { date, startTime, endTime, ...(description ? { description } : {}) };
}

function normalizeManualSchedule(
  value: Record<string, unknown>,
): EventScheduleEnvelope {
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
  const seen = new Set<string>();
  let previousDate = '';
  const days = value.days.map((day) => {
    const normalized = normalizeScheduleDay(day);
    if (seen.has(normalized.date)) {
      throw new EventScheduleValidationError(
        'Schedule days must not include duplicate dates',
      );
    }
    if (previousDate && normalized.date < previousDate) {
      throw new EventScheduleValidationError(
        'Schedule days must be sorted chronologically',
      );
    }
    seen.add(normalized.date);
    previousDate = normalized.date;
    return normalized;
  });
  const schedule: ManualEventSchedule = {
    timezone: EVENT_SCHEDULE_TIMEZONE,
    ...(value.mode === 'manual' ? { mode: 'manual' as const } : {}),
    days,
  };
  return {
    schedule,
    startAt: eventWallClockToUtcIsoString(days[0].date, days[0].startTime),
    endAt: eventWallClockToUtcIsoString(
      days[days.length - 1].date,
      days[days.length - 1].endTime,
    ),
  };
}

export function isOccurrenceDate(
  anchorDate: string,
  interval: 1 | 2,
  candidateDate: string,
): boolean {
  const difference = eventCalendarDayDifference(anchorDate, candidateDate);
  return difference >= 0 && difference % (interval * 7) === 0;
}

export function lastLogicalOccurrenceDate(
  rule: EventRecurrenceRule,
): string | null {
  if (!rule.endDate) return null;
  const span = eventCalendarDayDifference(rule.anchorDate, rule.endDate);
  const step = rule.interval * 7;
  return addEventCalendarDays(rule.anchorDate, Math.floor(span / step) * step);
}

function normalizeRule(input: unknown): EventRecurrenceRule {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new EventScheduleValidationError('recurrence must be an object');
  }
  const value = input as Record<string, unknown>;
  const anchorDate =
    typeof value.anchorDate === 'string' ? value.anchorDate.trim() : '';
  const startTime =
    typeof value.startTime === 'string' ? value.startTime.trim() : '';
  const endTime = typeof value.endTime === 'string' ? value.endTime.trim() : '';
  const endDate =
    typeof value.endDate === 'string' && value.endDate.trim()
      ? value.endDate.trim()
      : undefined;
  if (value.unit !== 'week' || (value.interval !== 1 && value.interval !== 2)) {
    throw new EventScheduleValidationError(
      'Recurring schedule must repeat every one or two weeks',
    );
  }
  if (!parseEventDate(anchorDate) || (endDate && !parseEventDate(endDate))) {
    throw new EventScheduleValidationError('Invalid recurrence date');
  }
  if (endDate && endDate < anchorDate) {
    throw new EventScheduleValidationError(
      'recurrence.endDate must not precede anchorDate',
    );
  }
  assertTimes(startTime, endTime);
  return {
    unit: 'week',
    interval: value.interval,
    anchorDate,
    startTime,
    endTime,
    ...(endDate ? { endDate } : {}),
  };
}

function assertExceptionDate(
  date: string,
  field: string,
  rule: EventRecurrenceRule,
): void {
  if (!parseEventDate(date)) {
    throw new EventScheduleValidationError(`${field} contains invalid date`);
  }
  if (!isOccurrenceDate(rule.anchorDate, rule.interval, date)) {
    throw new EventScheduleValidationError(
      `${field} date must belong to recurrence cadence`,
    );
  }
  if (rule.endDate && date > rule.endDate) {
    throw new EventScheduleValidationError(
      `${field} date must not follow recurrence.endDate`,
    );
  }
}

function normalizeDateArray(
  input: unknown,
  field: string,
  rule: EventRecurrenceRule,
): string[] {
  if (!Array.isArray(input)) {
    throw new EventScheduleValidationError(`${field} must be an array`);
  }
  if (input.length > EVENT_SCHEDULE_MAX_EXCEPTIONS) {
    throw new EventScheduleValidationError(
      `${field} must include at most ${EVENT_SCHEDULE_MAX_EXCEPTIONS} dates`,
    );
  }
  const seen = new Set<string>();
  return input.map((entry) => {
    const date = typeof entry === 'string' ? entry.trim() : '';
    assertExceptionDate(date, field, rule);
    if (seen.has(date)) {
      throw new EventScheduleValidationError(
        `${field} contains duplicate date`,
      );
    }
    seen.add(date);
    return date;
  });
}

function normalizeOverrides(
  input: unknown,
  rule: EventRecurrenceRule,
): EventScheduleOverride[] {
  if (!Array.isArray(input)) {
    throw new EventScheduleValidationError('overrides must be an array');
  }
  if (input.length > EVENT_SCHEDULE_MAX_EXCEPTIONS) {
    throw new EventScheduleValidationError(
      `overrides must include at most ${EVENT_SCHEDULE_MAX_EXCEPTIONS} dates`,
    );
  }
  const seen = new Set<string>();
  return input.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new EventScheduleValidationError('override must be an object');
    }
    const value = entry as Record<string, unknown>;
    const date = typeof value.date === 'string' ? value.date.trim() : '';
    assertExceptionDate(date, 'override', rule);
    if (seen.has(date)) {
      throw new EventScheduleValidationError('override date must be unique');
    }
    const startTime =
      typeof value.startTime === 'string' && value.startTime.trim()
        ? value.startTime.trim()
        : undefined;
    const endTime =
      typeof value.endTime === 'string' && value.endTime.trim()
        ? value.endTime.trim()
        : undefined;
    assertTimes(startTime ?? rule.startTime, endTime ?? rule.endTime);
    const description = normalizeDescription(value.description);
    if (!startTime && !endTime && !description) {
      throw new EventScheduleValidationError(
        'override must change time or description',
      );
    }
    seen.add(date);
    return {
      date,
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(description ? { description } : {}),
    };
  });
}

function countLogicalOccurrences(rule: EventRecurrenceRule): number | null {
  if (!rule.endDate) return null;
  return (
    Math.floor(
      eventCalendarDayDifference(rule.anchorDate, rule.endDate) /
        (rule.interval * 7),
    ) + 1
  );
}

function occurrenceForDate(
  schedule: RecurringEventScheduleStored,
  date: string,
): RecurringOccurrenceRead {
  const override = schedule.overrides.find((item) => item.date === date);
  return {
    date,
    startTime: override?.startTime ?? schedule.recurrence.startTime,
    endTime: override?.endTime ?? schedule.recurrence.endTime,
    ...(override?.description ? { description: override.description } : {}),
    status: schedule.cancelledDates.includes(date) ? 'cancelled' : 'active',
  };
}

function toActiveOccurrence(
  occurrence: RecurringOccurrenceRead,
): EventScheduleDay {
  return {
    date: occurrence.date,
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    ...(occurrence.description ? { description: occurrence.description } : {}),
  };
}

function findLastActiveDate(
  schedule: RecurringEventScheduleStored,
): string | null {
  const last = lastLogicalOccurrenceDate(schedule.recurrence);
  if (!last) return null;
  const cancelled = new Set(schedule.cancelledDates);
  for (
    let date = last;
    date >= schedule.recurrence.anchorDate;
    date = addEventCalendarDays(date, -schedule.recurrence.interval * 7)
  ) {
    if (!cancelled.has(date)) return date;
  }
  return null;
}

function normalizeRecurringSchedule(
  value: Record<string, unknown>,
): EventScheduleEnvelope {
  const recurrence = normalizeRule(value.recurrence);
  const cancelledDates = normalizeDateArray(
    value.cancelledDates ?? [],
    'cancelledDates',
    recurrence,
  );
  const overrides = normalizeOverrides(value.overrides ?? [], recurrence);
  const logicalCount = countLogicalOccurrences(recurrence);
  const schedule: RecurringEventScheduleStored = {
    timezone: EVENT_SCHEDULE_TIMEZONE,
    mode: 'recurring',
    recurrence,
    cancelledDates,
    overrides,
    hasActiveOccurrences:
      logicalCount === null || cancelledDates.length < logicalCount,
  };
  const lastActiveDate = findLastActiveDate(schedule);
  return {
    schedule,
    startAt: eventWallClockToUtcIsoString(
      recurrence.anchorDate,
      recurrence.startTime,
    ),
    endAt: eventWallClockToUtcIsoString(
      lastActiveDate ?? recurrence.anchorDate,
      lastActiveDate
        ? occurrenceForDate(schedule, lastActiveDate).endTime
        : recurrence.endTime,
    ),
  };
}

export function normalizeEventSchedule(input: unknown): EventScheduleEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new EventScheduleValidationError('Schedule must be an object');
  }
  const value = input as Record<string, unknown>;
  if ((value.timezone ?? EVENT_SCHEDULE_TIMEZONE) !== EVENT_SCHEDULE_TIMEZONE) {
    throw new EventScheduleValidationError(
      `Schedule timezone must be ${EVENT_SCHEDULE_TIMEZONE}`,
    );
  }
  return value.mode === 'recurring'
    ? normalizeRecurringSchedule(value)
    : normalizeManualSchedule(value);
}

function firstLogicalOnOrAfter(
  rule: EventRecurrenceRule,
  candidateDate: string,
): string {
  if (candidateDate <= rule.anchorDate) return rule.anchorDate;
  const step = rule.interval * 7;
  const difference = eventCalendarDayDifference(rule.anchorDate, candidateDate);
  return addEventCalendarDays(
    rule.anchorDate,
    Math.ceil(difference / step) * step,
  );
}

function findNextActiveOccurrence(
  schedule: RecurringEventScheduleStored,
  now: Date,
): EventScheduleDay | null {
  const localNow = eventDateTimeToLocalKey(now);
  let date = firstLogicalOnOrAfter(schedule.recurrence, localNow.date);
  if (
    date === localNow.date &&
    occurrenceForDate(schedule, date).endTime <= localNow.time
  ) {
    date = addEventCalendarDays(date, schedule.recurrence.interval * 7);
  }
  const cancelled = new Set(schedule.cancelledDates);
  const maximumSteps = schedule.recurrence.endDate
    ? countLogicalOccurrences(schedule.recurrence) ?? 0
    : cancelled.size + 1;
  for (let index = 0; index <= maximumSteps; index++) {
    if (schedule.recurrence.endDate && date > schedule.recurrence.endDate) {
      return null;
    }
    if (!cancelled.has(date)) {
      return toActiveOccurrence(occurrenceForDate(schedule, date));
    }
    date = addEventCalendarDays(date, schedule.recurrence.interval * 7);
  }
  return null;
}

function buildPreview(
  schedule: RecurringEventScheduleStored,
  status: EventStatus | undefined,
  now: Date,
  limit: number,
  includeCancelled: boolean,
): RecurringOccurrenceRead[] {
  const rule = schedule.recurrence;
  const next = findNextActiveOccurrence(schedule, now);
  const localNow = eventDateTimeToLocalKey(now);
  const logicalBoundary = lastLogicalOccurrenceDate(rule);
  const useHistory =
    status === EventStatus.Completed ||
    Boolean(logicalBoundary && logicalBoundary < localNow.date) ||
    Boolean(!next && logicalBoundary);
  if (!includeCancelled && status === EventStatus.Cancelled) return [];
  let first: string;
  if (useHistory) {
    const last = logicalBoundary ?? rule.anchorDate;
    const logicalCount = countLogicalOccurrences(rule) ?? limit;
    first = addEventCalendarDays(
      last,
      -Math.min(limit - 1, logicalCount - 1) * rule.interval * 7,
    );
  } else {
    first = firstLogicalOnOrAfter(rule, localNow.date);
    if (
      first === localNow.date &&
      occurrenceForDate(schedule, first).endTime <= localNow.time
    ) {
      first = addEventCalendarDays(first, rule.interval * 7);
    }
  }
  const result: RecurringOccurrenceRead[] = [];
  if (useHistory && !includeCancelled) {
    for (
      let date = logicalBoundary ?? rule.anchorDate;
      date >= rule.anchorDate && result.length < limit;
      date = addEventCalendarDays(date, -rule.interval * 7)
    ) {
      const occurrence = occurrenceForDate(schedule, date);
      if (occurrence.status === 'active') result.push(occurrence);
    }
    return result.reverse();
  }
  for (let date = first; result.length < limit; ) {
    if (rule.endDate && date > rule.endDate) break;
    const occurrence = occurrenceForDate(schedule, date);
    if (includeCancelled || occurrence.status === 'active') {
      result.push(occurrence);
    }
    date = addEventCalendarDays(date, rule.interval * 7);
  }
  return result;
}

export function projectEventScheduleForRead(
  schedule: EventScheduleStored | undefined,
  status?: EventStatus,
  now = new Date(),
  previewLimit = EVENT_SCHEDULE_PREVIEW_LIMIT,
  includeCancelled = true,
): EventScheduleRead | undefined {
  if (!schedule || schedule.mode !== 'recurring') {
    return schedule as EventScheduleRead | undefined;
  }
  const normalized = normalizeEventSchedule(schedule)
    .schedule as RecurringEventScheduleStored;
  const occurrencePreview = buildPreview(
    normalized,
    status,
    now,
    previewLimit,
    includeCancelled,
  );
  const nextActiveOccurrence =
    status === EventStatus.Completed || status === EventStatus.Cancelled
      ? null
      : findNextActiveOccurrence(normalized, now);
  const lastDate = findLastActiveDate(normalized);
  const lastOccurrence = lastDate
    ? occurrenceForDate(normalized, lastDate)
    : null;
  const lastActiveOccurrence = lastOccurrence
    ? toActiveOccurrence(lastOccurrence)
    : null;
  return {
    ...normalized,
    occurrencePreview,
    days: occurrencePreview
      .filter((occurrence) => occurrence.status === 'active')
      .map(toActiveOccurrence),
    nextActiveOccurrence,
    lastActiveOccurrence,
  } satisfies RecurringEventScheduleRead;
}

export function hasActiveOccurrenceInRange(
  schedule: EventScheduleStored | undefined,
  status: EventStatus,
  from?: string,
  to?: string,
): boolean {
  if (!schedule || schedule.mode !== 'recurring') return true;
  if (status === EventStatus.Cancelled || status === EventStatus.Completed) {
    return false;
  }
  const normalized = normalizeEventSchedule(schedule)
    .schedule as RecurringEventScheduleStored;
  if (!normalized.hasActiveOccurrences) return false;
  let date = firstLogicalOnOrAfter(
    normalized.recurrence,
    from ?? normalized.recurrence.anchorDate,
  );
  const cancelled = new Set(normalized.cancelledDates);
  const last = to ?? normalized.recurrence.endDate;
  const maximumSteps = normalized.recurrence.endDate
    ? countLogicalOccurrences(normalized.recurrence) ?? 0
    : cancelled.size + 1;
  for (let index = 0; index <= maximumSteps; index++) {
    if (last && date > last) return false;
    if (normalized.recurrence.endDate && date > normalized.recurrence.endDate) {
      return false;
    }
    if (!cancelled.has(date)) return true;
    date = addEventCalendarDays(date, normalized.recurrence.interval * 7);
  }
  return false;
}

export function isRecurringSchedule(
  schedule: EventScheduleWrite | EventScheduleStored | undefined,
): schedule is RecurringEventScheduleStored {
  return schedule?.mode === 'recurring';
}
