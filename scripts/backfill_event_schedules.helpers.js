const crypto = require('node:crypto');

const EVENT_SCHEDULE_TIMEZONE = 'Asia/Tbilisi';
const STRICT_UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_MAX_DAYS = 366;

const AMBIGUOUS_REASONS = {
  MissingLegacyTiming: 'missingLegacyTiming',
  NonStrictUtcIso: 'nonStrictUtcIso',
  MalformedLegacyTiming: 'malformedLegacyTiming',
  EndNotAfterStart: 'endAtNotAfterStartAt',
  MultiDayEndTimeNotAfterStartTime: 'multiDayEndTimeNotAfterStartTime',
  MultiDayLegacyRangeRequiresReview: 'multiDayLegacyRangeRequiresReview',
  UnexpectedlyLargeRange: 'unexpectedlyLargeRange',
  ImpossibleLocalConversion: 'impossibleLocalConversion',
  MalformedExistingSchedule: 'malformedExistingSchedule',
};

function parsePositiveInteger(rawValue, optionName) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  return value;
}

function readOptionValue(argv, index, optionName) {
  const arg = argv[index];
  const prefix = `${optionName}=`;
  if (arg.startsWith(prefix)) {
    return { value: arg.slice(prefix.length), nextIndex: index };
  }

  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }

  return { value, nextIndex: index + 1 };
}

function parseOptions(argv = []) {
  const options = {
    write: false,
    confirmProductionBackfill: false,
    limit: undefined,
    maxDays: DEFAULT_MAX_DAYS,
    manifestPath: undefined,
    rollbackManifestPath: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') {
      options.write = true;
    } else if (arg === '--confirm-production-backfill') {
      options.confirmProductionBackfill = true;
    } else if (arg === '--limit' || arg.startsWith('--limit=')) {
      const parsed = readOptionValue(argv, i, '--limit');
      options.limit = parsePositiveInteger(parsed.value, '--limit');
      i = parsed.nextIndex;
    } else if (arg === '--max-days' || arg.startsWith('--max-days=')) {
      const parsed = readOptionValue(argv, i, '--max-days');
      options.maxDays = parsePositiveInteger(parsed.value, '--max-days');
      i = parsed.nextIndex;
    } else if (arg === '--manifest' || arg.startsWith('--manifest=')) {
      const parsed = readOptionValue(argv, i, '--manifest');
      options.manifestPath = parsed.value;
      i = parsed.nextIndex;
    } else if (
      arg === '--rollback-manifest' ||
      arg.startsWith('--rollback-manifest=')
    ) {
      const parsed = readOptionValue(argv, i, '--rollback-manifest');
      options.rollbackManifestPath = parsed.value;
      i = parsed.nextIndex;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.write && !options.confirmProductionBackfill) {
    throw new Error(
      'Refusing to write without --confirm-production-backfill. Run with both --write --confirm-production-backfill.',
    );
  }

  if (options.rollbackManifestPath && options.manifestPath) {
    throw new Error('Use only one of --manifest or --rollback-manifest');
  }

  return options;
}

function idToString(value) {
  return value ? value.toString() : '';
}

function normalizeForComparison(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForComparison);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const normalized = normalizeForComparison(value[key]);
        if (normalized !== undefined) {
          acc[key] = normalized;
        }
        return acc;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(normalizeForComparison(value));
}

function stableEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

function computeScheduleFingerprint(schedule) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(schedule))
    .digest('hex');
}

function parseDateParts(value) {
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

function isValidEventTime(value) {
  return TIME_PATTERN.test(value);
}

function utcIsoToEventParts(value) {
  const date = new Date(value);
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

  const datePart = `${parts.year}-${parts.month}-${parts.day}`;
  const timePart = `${parts.hour}:${parts.minute}`;

  if (!parseDateParts(datePart) || !isValidEventTime(timePart)) {
    return null;
  }

  return {
    date: datePart,
    time: timePart,
  };
}

function addUtcDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function enumerateDateRange(startDate, endDate) {
  if (
    !parseDateParts(startDate) ||
    !parseDateParts(endDate) ||
    startDate > endDate
  ) {
    return [];
  }

  const dates = [];
  let cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = addUtcDays(cursor, 1);
  }

  return dates;
}

function parseStrictUtcIso(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, reason: AMBIGUOUS_REASONS.MissingLegacyTiming };
  }

  if (!STRICT_UTC_ISO_PATTERN.test(value)) {
    return { ok: false, reason: AMBIGUOUS_REASONS.NonStrictUtcIso };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    return { ok: false, reason: AMBIGUOUS_REASONS.MalformedLegacyTiming };
  }

  return { ok: true, date };
}

function normalizeExistingSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    throw new Error('Schedule must be an object');
  }

  const timezone =
    schedule.timezone === undefined
      ? EVENT_SCHEDULE_TIMEZONE
      : schedule.timezone;
  if (timezone !== EVENT_SCHEDULE_TIMEZONE) {
    throw new Error(`Schedule timezone must be ${EVENT_SCHEDULE_TIMEZONE}`);
  }

  if (!Array.isArray(schedule.days) || schedule.days.length === 0) {
    throw new Error('Schedule days must include at least one day');
  }

  const seenDates = new Set();
  let previousDate = '';
  const days = schedule.days.map((rawDay) => {
    if (!rawDay || typeof rawDay !== 'object' || Array.isArray(rawDay)) {
      throw new Error('Schedule day must be an object');
    }

    const date = typeof rawDay.date === 'string' ? rawDay.date.trim() : '';
    const startTime =
      typeof rawDay.startTime === 'string' ? rawDay.startTime.trim() : '';
    const endTime =
      typeof rawDay.endTime === 'string' ? rawDay.endTime.trim() : '';

    if (!parseDateParts(date)) {
      throw new Error('Schedule day date must be a real YYYY-MM-DD date');
    }

    if (!isValidEventTime(startTime) || !isValidEventTime(endTime)) {
      throw new Error('Schedule day times must be HH:mm values');
    }

    if (startTime >= endTime) {
      throw new Error('Schedule day endTime must be after startTime');
    }

    if (seenDates.has(date)) {
      throw new Error('Schedule days must not include duplicate dates');
    }

    if (previousDate && date < previousDate) {
      throw new Error('Schedule days must be sorted chronologically');
    }

    seenDates.add(date);
    previousDate = date;

    const description =
      typeof rawDay.description === 'string' ? rawDay.description.trim() : '';

    return {
      date,
      startTime,
      endTime,
      ...(description ? { description } : {}),
    };
  });

  return {
    timezone: EVENT_SCHEDULE_TIMEZONE,
    days,
  };
}

function createAmbiguousProposal(event, reason, details) {
  return {
    status: 'ambiguous',
    reason,
    details,
    _id: idToString(event?._id),
  };
}

function buildManifestEntry(event, schedule) {
  return {
    eventId: idToString(event._id),
    originalStartAt: event.startAt,
    originalEndAt: event.endAt,
    generatedSchedule: schedule,
    scheduleFingerprint: computeScheduleFingerprint(schedule),
  };
}

function buildEventScheduleMigrationProposal(event, options = {}) {
  const hasSchedule = Object.prototype.hasOwnProperty.call(
    event || {},
    'schedule',
  );

  if (hasSchedule) {
    try {
      return {
        status: 'alreadyScheduled',
        schedule: normalizeExistingSchedule(event.schedule),
      };
    } catch (error) {
      return createAmbiguousProposal(
        event,
        AMBIGUOUS_REASONS.MalformedExistingSchedule,
        error.message || String(error),
      );
    }
  }

  const start = parseStrictUtcIso(event?.startAt);
  const end = parseStrictUtcIso(event?.endAt);

  if (!start.ok) {
    return createAmbiguousProposal(event, start.reason, 'Invalid startAt');
  }

  if (!end.ok) {
    return createAmbiguousProposal(event, end.reason, 'Invalid endAt');
  }

  if (end.date.getTime() <= start.date.getTime()) {
    return createAmbiguousProposal(
      event,
      AMBIGUOUS_REASONS.EndNotAfterStart,
      'endAt must be after startAt',
    );
  }

  const startParts = utcIsoToEventParts(event.startAt);
  const endParts = utcIsoToEventParts(event.endAt);

  if (!startParts || !endParts) {
    return createAmbiguousProposal(
      event,
      AMBIGUOUS_REASONS.ImpossibleLocalConversion,
      'Could not convert legacy UTC instants to event wall-clock time',
    );
  }

  const dates = enumerateDateRange(startParts.date, endParts.date);
  if (!dates.length) {
    return createAmbiguousProposal(
      event,
      AMBIGUOUS_REASONS.ImpossibleLocalConversion,
      'Could not enumerate event local dates',
    );
  }

  const maxDays = options.maxDays || DEFAULT_MAX_DAYS;
  if (dates.length > maxDays) {
    return createAmbiguousProposal(
      event,
      AMBIGUOUS_REASONS.UnexpectedlyLargeRange,
      `${dates.length} schedule days exceeds --max-days=${maxDays}`,
    );
  }

  if (dates.length > 1) {
    return createAmbiguousProposal(
      event,
      AMBIGUOUS_REASONS.MultiDayLegacyRangeRequiresReview,
      'Multi-day legacy range needs manual schedule review',
    );
  }

  if (dates.length === 1 && startParts.time >= endParts.time) {
    return createAmbiguousProposal(
      event,
      AMBIGUOUS_REASONS.ImpossibleLocalConversion,
      'Same-day local schedule would not end after it starts',
    );
  }

  const schedule = {
    timezone: EVENT_SCHEDULE_TIMEZONE,
    days: dates.map((date) => ({
      date,
      startTime: startParts.time,
      endTime: endParts.time,
    })),
  };
  const manifestEntry = buildManifestEntry(event, schedule);

  return {
    status: 'migrate',
    schedule,
    manifestEntry,
    mutation: {
      filter: {
        _id: idToString(event._id),
        schedule: { $exists: false },
      },
      update: {
        $set: {
          schedule,
        },
      },
    },
  };
}

function createMigrationSample(event, proposal) {
  return {
    _id: idToString(event._id),
    title: event.title,
    slug: event.slug,
    originalStartAt: event.startAt,
    originalEndAt: event.endAt,
    generatedSchedule: proposal.schedule,
    scheduleFingerprint: proposal.manifestEntry.scheduleFingerprint,
  };
}

function createAmbiguousSample(event, proposal) {
  return {
    _id: idToString(event?._id),
    title: event?.title,
    slug: event?.slug,
    reason: proposal.reason,
    details: proposal.details,
    startAt: event?.startAt,
    endAt: event?.endAt,
  };
}

function createRollbackDecision(event, manifestEntry) {
  if (!event) {
    return { status: 'skipped', reason: 'missingEvent' };
  }

  if (!event.schedule) {
    return { status: 'skipped', reason: 'missingSchedule' };
  }

  const currentFingerprint = computeScheduleFingerprint(
    normalizeForComparison(event.schedule),
  );

  if (currentFingerprint !== manifestEntry.scheduleFingerprint) {
    return {
      status: 'skipped',
      reason: 'fingerprintMismatch',
      currentFingerprint,
      expectedFingerprint: manifestEntry.scheduleFingerprint,
    };
  }

  return {
    status: 'revert',
    currentFingerprint,
  };
}

function normalizeManifest(rawManifest) {
  if (Array.isArray(rawManifest)) {
    return { entries: rawManifest };
  }

  if (
    rawManifest &&
    typeof rawManifest === 'object' &&
    Array.isArray(rawManifest.entries)
  ) {
    return rawManifest;
  }

  throw new Error(
    'Manifest must be an object with entries[] or an entries array',
  );
}

function createManifest({ entries, options, mode, createdAt = new Date() }) {
  return {
    kind: 'event-schedule-backfill-manifest',
    createdAt: createdAt.toISOString(),
    mode,
    options: {
      maxDays: options.maxDays,
      limit: options.limit,
    },
    entries,
  };
}

module.exports = {
  AMBIGUOUS_REASONS,
  DEFAULT_MAX_DAYS,
  EVENT_SCHEDULE_TIMEZONE,
  buildEventScheduleMigrationProposal,
  buildManifestEntry,
  computeScheduleFingerprint,
  createAmbiguousSample,
  createManifest,
  createMigrationSample,
  createRollbackDecision,
  enumerateDateRange,
  idToString,
  normalizeExistingSchedule,
  normalizeForComparison,
  normalizeManifest,
  parseOptions,
  parseStrictUtcIso,
  stableEqual,
  stableStringify,
  utcIsoToEventParts,
};
