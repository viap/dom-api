export class DateRangeValidator {
  static isValidDateRange(startDate: Date, endDate: Date): boolean {
    return endDate > startDate;
  }

  static isValidDuration(
    startDate: Date,
    endDate: Date,
    minMinutes = 15,
    maxMinutes = 1440,
  ): boolean {
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    return durationMinutes >= minMinutes && durationMinutes <= maxMinutes;
  }

  static isInFuture(date: Date, bufferMinutes = 0): boolean {
    const now = new Date();
    const bufferMs = bufferMinutes * 60 * 1000;
    return date.getTime() > now.getTime() + bufferMs;
  }

  static isWithinBusinessHours(
    startTime: string,
    endTime: string,
    businessStart = '09:00',
    businessEnd = '17:00',
  ): boolean {
    return startTime >= businessStart && endTime <= businessEnd;
  }

  static getWorkingDaysBetween(startDate: Date, endDate: Date): number {
    let count = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday (0) or Saturday (6)
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return count;
  }

  static formatDateRange(startDate: Date, endDate: Date): string {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    return `${start} to ${end}`;
  }

  static getDurationInMinutes(startDate: Date, endDate: Date): number {
    const durationMs = endDate.getTime() - startDate.getTime();
    return Math.round(durationMs / (1000 * 60));
  }

  static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  static isOverlapping(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }
}
