export const EVENT_SCHEDULE_TIMEZONE = 'Asia/Tbilisi';
export const EVENT_SCHEDULE_MAX_DAYS = 366;
export const EVENT_SCHEDULE_DAY_DESCRIPTION_MAX_LENGTH = 500;

export interface EventScheduleDay {
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export interface EventSchedule {
  timezone: typeof EVENT_SCHEDULE_TIMEZONE;
  days: EventScheduleDay[];
}
