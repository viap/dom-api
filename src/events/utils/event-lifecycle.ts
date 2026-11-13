import { EventStatus } from '../enums/event-status.enum';

export type EffectiveEventLifecycle =
  | EventStatus.Draft
  | EventStatus.Active
  | EventStatus.Cancelled
  | EventStatus.Completed
  | 'invalid';

const LEGACY_ACTIVE = new Set<string>([
  EventStatus.Planned,
  EventStatus.RegistrationOpen,
  EventStatus.Ongoing,
]);

export function normalizeEffectiveLifecycle(
  status: unknown,
): EffectiveEventLifecycle {
  if (LEGACY_ACTIVE.has(String(status))) return EventStatus.Active;
  if (
    status === EventStatus.Draft ||
    status === EventStatus.Active ||
    status === EventStatus.Cancelled ||
    status === EventStatus.Completed
  ) {
    return status;
  }
  return 'invalid';
}

export function isPublicEventLifecycle(status: unknown): boolean {
  const lifecycle = normalizeEffectiveLifecycle(status);
  return (
    lifecycle === EventStatus.Active ||
    lifecycle === EventStatus.Cancelled ||
    lifecycle === EventStatus.Completed
  );
}

export function isActiveLikeEventStatus(status: unknown): boolean {
  return normalizeEffectiveLifecycle(status) === EventStatus.Active;
}
