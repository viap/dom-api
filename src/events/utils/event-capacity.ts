import { ConflictException } from '@nestjs/common';
import { CapacityMutation } from '../types/capacity-mutation.interface';

type StoredCapacity = {
  capacity?: unknown;
  registration?: { maxParticipants?: unknown };
};

function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

export function readCapacityDiagnostic(event: StoredCapacity) {
  const capacity = positiveInteger(event.capacity);
  const maxParticipants = positiveInteger(event.registration?.maxParticipants);
  const hasInvalidCapacity =
    event.capacity !== undefined && capacity === undefined;
  const hasInvalidLegacy =
    event.registration?.maxParticipants !== undefined &&
    maxParticipants === undefined;
  const conflict =
    capacity !== undefined &&
    maxParticipants !== undefined &&
    capacity !== maxParticipants
      ? { capacity, maxParticipants }
      : undefined;

  return {
    effectiveCapacity: capacity ?? maxParticipants,
    ...(conflict ? { conflict } : {}),
    invalid: hasInvalidCapacity || hasInvalidLegacy,
    unusable:
      capacity === undefined &&
      maxParticipants === undefined &&
      (hasInvalidCapacity || hasInvalidLegacy),
  };
}

function snapshotsEqual(
  stored: { capacity?: number; maxParticipants?: number },
  expected: { capacity?: number; maxParticipants?: number } | undefined,
): boolean {
  return (
    expected !== undefined &&
    expected.capacity === stored.capacity &&
    expected.maxParticipants === stored.maxParticipants
  );
}

export function buildCapacityUpdate(params: {
  event: StoredCapacity;
  mutation?: CapacityMutation;
  directCapacityPresent: boolean;
  directCapacity?: number | null;
}): { set?: number; clear: boolean } | null {
  const diagnostic = readCapacityDiagnostic(params.event);
  const storedSnapshot = {
    ...(positiveInteger(params.event.capacity) !== undefined
      ? { capacity: positiveInteger(params.event.capacity) }
      : {}),
    ...(positiveInteger(params.event.registration?.maxParticipants) !==
    undefined
      ? {
          maxParticipants: positiveInteger(
            params.event.registration?.maxParticipants,
          ),
        }
      : {}),
  };

  if (!params.mutation) {
    if (!params.directCapacityPresent) return null;
    if (diagnostic.conflict) {
      throw new ConflictException('CAPACITY_CONFLICT');
    }
    if (params.directCapacity === null) return { clear: true };
    if (params.directCapacity === diagnostic.effectiveCapacity) return null;
    return { set: params.directCapacity, clear: false };
  }

  if (
    diagnostic.conflict &&
    !snapshotsEqual(storedSnapshot, params.mutation.expectedConflict)
  ) {
    throw new ConflictException('CAPACITY_CONFLICT');
  }
  if (
    params.mutation.expectedConflict &&
    !snapshotsEqual(storedSnapshot, params.mutation.expectedConflict)
  ) {
    throw new ConflictException('CAPACITY_CONFLICT');
  }

  if (params.mutation.action === 'clear') return { clear: true };
  if (params.mutation.action === 'use_legacy') {
    const legacy = storedSnapshot.maxParticipants;
    if (legacy === undefined) throw new ConflictException('CAPACITY_CONFLICT');
    return { set: legacy, clear: false };
  }
  return { set: params.mutation.value, clear: false };
}
