import { DomainEventDocument } from '../schemas/domain-event.schema';
import { RegistrationAvailability } from '../types/public-event.interface';
import {
  isRecurringSchedule,
  projectEventScheduleForRead,
} from './event-schedule';
import { normalizeEffectiveLifecycle } from './event-lifecycle';
import { EventStatus } from '../enums/event-status.enum';
import { readCapacityDiagnostic } from './event-capacity';

function validTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function getEventNextTransitionAt(
  event: DomainEventDocument,
  now: Date,
): string | undefined {
  const nowMs = now.getTime();
  const candidates: number[] = [];
  const add = (value: unknown) => {
    const time = validTime(value);
    if (time !== null && time > nowMs) candidates.push(time);
  };

  add(event.registration?.deadline);
  if (isRecurringSchedule(event.schedule)) {
    const read = projectEventScheduleForRead(
      event.schedule,
      event.status,
      now,
      2,
      false,
    );
    if (read?.mode === 'recurring' && read.nextActiveOccurrence) {
      const occurrence = read.nextActiveOccurrence;
      add(`${occurrence.date}T${occurrence.startTime}:00+04:00`);
      add(`${occurrence.date}T${occurrence.endTime}:00+04:00`);
    }
  } else {
    add(event.startAt);
    add(event.endAt);
  }

  return candidates.length
    ? new Date(Math.min(...candidates)).toISOString()
    : undefined;
}

export function getRegistrationAvailability(params: {
  event: DomainEventDocument;
  registeredCount: number;
  now: Date;
}): RegistrationAvailability {
  const { event, registeredCount, now } = params;
  if (normalizeEffectiveLifecycle(event.status) !== EventStatus.Active) {
    return 'closed';
  }
  if (event.registration?.isOpen !== true) return 'closed';
  const storedDeadline = event.registration?.deadline;
  const deadline = validTime(storedDeadline);
  if (storedDeadline !== undefined && deadline === null) return 'closed';
  if (deadline !== null && now.getTime() >= deadline) return 'closed';

  if (isRecurringSchedule(event.schedule)) {
    const projection = projectEventScheduleForRead(
      event.schedule,
      event.status,
      now,
      2,
      false,
    );
    if (
      projection?.mode !== 'recurring' ||
      !projection.hasActiveOccurrences ||
      !projection.nextActiveOccurrence
    ) {
      return 'closed';
    }
  } else {
    const end = validTime(event.endAt);
    if (end === null || now.getTime() >= end) return 'closed';
  }

  const capacity = readCapacityDiagnostic(event);
  if (capacity.unusable) return 'closed';
  if (capacity.effectiveCapacity === undefined) return 'open';
  return registeredCount >= capacity.effectiveCapacity ? 'waitlist' : 'open';
}
