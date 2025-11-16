export interface UpdateScheduleDto {
  title?: string;
  description?: string;
  type?: 'WORKING_HOURS' | 'UNAVAILABLE' | 'HOLIDAY' | 'MAINTENANCE';
  room?: string;
  company?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  isRecurring?: boolean;
  recurrencePattern?: {
    frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    endDate?: Date | string;
    maxOccurrences?: number;
  };
  timeZone?: string;
  isActive?: boolean;
  priority?: number;
  metadata?: {
    createdBy?: string;
    notes?: string;
    color?: string;
    tags?: string[];
  };
}
