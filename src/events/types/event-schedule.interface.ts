export const EVENT_SCHEDULE_TIMEZONE = 'Asia/Tbilisi';
export const EVENT_SCHEDULE_MAX_DAYS = 366;
export const EVENT_SCHEDULE_MAX_EXCEPTIONS = 366;
export const EVENT_SCHEDULE_PREVIEW_LIMIT = 12;
export const EVENT_SCHEDULE_ADMIN_PREVIEW_LIMIT = 52;
export const EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH = 500;

export interface EventScheduleDay {
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export interface ManualEventSchedule {
  timezone: typeof EVENT_SCHEDULE_TIMEZONE;
  mode?: 'manual';
  days: EventScheduleDay[];
}

export interface EventRecurrenceRule {
  unit: 'week';
  interval: 1 | 2;
  anchorDate: string;
  startTime: string;
  endTime: string;
  endDate?: string;
}

export interface EventScheduleOverride {
  date: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}

export interface RecurringEventScheduleWrite {
  timezone: typeof EVENT_SCHEDULE_TIMEZONE;
  mode: 'recurring';
  recurrence: EventRecurrenceRule;
  cancelledDates: string[];
  overrides: EventScheduleOverride[];
}

export interface RecurringEventScheduleStored
  extends RecurringEventScheduleWrite {
  hasActiveOccurrences: boolean;
}

export interface RecurringOccurrenceRead extends EventScheduleDay {
  status: 'active' | 'cancelled';
}

export interface RecurringEventScheduleRead
  extends RecurringEventScheduleStored {
  occurrencePreview: RecurringOccurrenceRead[];
  days: EventScheduleDay[];
  nextActiveOccurrence: EventScheduleDay | null;
  lastActiveOccurrence: EventScheduleDay | null;
}

export type EventScheduleWrite =
  | ManualEventSchedule
  | RecurringEventScheduleWrite;
export type EventScheduleStored =
  | ManualEventSchedule
  | RecurringEventScheduleStored;
export type EventScheduleRead =
  | ManualEventSchedule
  | RecurringEventScheduleRead;

/** Backward-compatible alias for persisted schedules. */
export type EventSchedule = EventScheduleStored;
