import { RecurrenceType } from '../../bookings/enums/recurrence-type.enum';

export interface RecurrenceOptions {
  type: RecurrenceType;
  interval: number;
  daysOfWeek?: number[];
  endDate?: Date;
  maxOccurrences?: number;
}

export interface RecurrenceInstance {
  startDateTime: Date;
  endDateTime: Date;
  instanceNumber: number;
}

export class RecurrenceCalculator {
  static generateRecurrenceInstances(
    baseStartDate: Date,
    baseEndDate: Date,
    options: RecurrenceOptions,
  ): RecurrenceInstance[] {
    const instances: RecurrenceInstance[] = [];

    if (options.type === RecurrenceType.NONE) {
      return [
        {
          startDateTime: baseStartDate,
          endDateTime: baseEndDate,
          instanceNumber: 1,
        },
      ];
    }

    const duration = baseEndDate.getTime() - baseStartDate.getTime();
    let currentDate = new Date(baseStartDate);
    let instanceNumber = 1;
    const maxInstances = options.maxOccurrences || 100; // Safety limit

    while (instanceNumber <= maxInstances) {
      if (options.endDate && currentDate > options.endDate) {
        break;
      }

      // Check if this date should be included based on recurrence type
      if (this.shouldIncludeDate(currentDate, options)) {
        const instanceStart = new Date(currentDate);
        const instanceEnd = new Date(currentDate.getTime() + duration);

        instances.push({
          startDateTime: instanceStart,
          endDateTime: instanceEnd,
          instanceNumber,
        });
      }

      // Move to next occurrence
      currentDate = this.getNextOccurrenceDate(currentDate, options);
      instanceNumber++;
    }

    return instances;
  }

  private static shouldIncludeDate(
    date: Date,
    options: RecurrenceOptions,
  ): boolean {
    switch (options.type) {
      case RecurrenceType.DAILY:
        return true;

      case RecurrenceType.WEEKLY:
        if (options.daysOfWeek && options.daysOfWeek.length > 0) {
          return options.daysOfWeek.includes(date.getDay());
        }
        return true;

      case RecurrenceType.MONTHLY:
        return true;

      case RecurrenceType.YEARLY:
        return true;

      default:
        return false;
    }
  }

  private static getNextOccurrenceDate(
    currentDate: Date,
    options: RecurrenceOptions,
  ): Date {
    const nextDate = new Date(currentDate);

    switch (options.type) {
      case RecurrenceType.DAILY:
        nextDate.setDate(nextDate.getDate() + options.interval);
        break;

      case RecurrenceType.WEEKLY:
        if (options.daysOfWeek && options.daysOfWeek.length > 0) {
          // Find next day of week in the list
          const currentDayOfWeek = nextDate.getDay();
          const sortedDays = [...options.daysOfWeek].sort((a, b) => a - b);

          let nextDayOfWeek = sortedDays.find((day) => day > currentDayOfWeek);

          if (nextDayOfWeek === undefined) {
            // No more days this week, go to first day of next week(s)
            nextDayOfWeek = sortedDays[0];
            const daysToAdd =
              7 * options.interval - currentDayOfWeek + nextDayOfWeek;
            nextDate.setDate(nextDate.getDate() + daysToAdd);
          } else {
            // Move to next day in the same week
            const daysToAdd = nextDayOfWeek - currentDayOfWeek;
            nextDate.setDate(nextDate.getDate() + daysToAdd);
          }
        } else {
          nextDate.setDate(nextDate.getDate() + 7 * options.interval);
        }
        break;

      case RecurrenceType.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + options.interval);
        break;

      case RecurrenceType.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + options.interval);
        break;
    }

    return nextDate;
  }

  static getNextOccurrence(
    baseDate: Date,
    options: RecurrenceOptions,
  ): Date | null {
    if (options.type === RecurrenceType.NONE) {
      return null;
    }

    const instances = this.generateRecurrenceInstances(baseDate, baseDate, {
      ...options,
      maxOccurrences: 2,
    });

    return instances.length > 1 ? instances[1].startDateTime : null;
  }

  static getOccurrencesInDateRange(
    baseStartDate: Date,
    baseEndDate: Date,
    options: RecurrenceOptions,
    rangeStart: Date,
    rangeEnd: Date,
  ): RecurrenceInstance[] {
    const allInstances = this.generateRecurrenceInstances(
      baseStartDate,
      baseEndDate,
      options,
    );

    return allInstances.filter(
      (instance) =>
        instance.startDateTime >= rangeStart &&
        instance.startDateTime <= rangeEnd,
    );
  }

  static isValidRecurrenceOptions(options: RecurrenceOptions): boolean {
    if (options.interval < 1) {
      return false;
    }

    if (options.type === RecurrenceType.WEEKLY && options.daysOfWeek) {
      if (
        options.daysOfWeek.length === 0 ||
        options.daysOfWeek.some((day) => day < 0 || day > 6)
      ) {
        return false;
      }
    }

    return true;
  }

  static calculateRecurrenceEndDate(
    startDate: Date,
    options: RecurrenceOptions,
    maxOccurrences: number,
  ): Date {
    const instances = this.generateRecurrenceInstances(startDate, startDate, {
      ...options,
      maxOccurrences,
    });

    return instances.length > 0
      ? instances[instances.length - 1].startDateTime
      : startDate;
  }
}
