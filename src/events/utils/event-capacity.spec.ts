import { ConflictException } from '@nestjs/common';
import { buildCapacityUpdate, readCapacityDiagnostic } from './event-capacity';

describe('Event capacity mutation intent', () => {
  const conflicting = {
    capacity: 10,
    registration: { maxParticipants: 20 },
  };

  it('preserves both legacy values for unrelated updates', () => {
    expect(
      buildCapacityUpdate({
        event: conflicting,
        directCapacityPresent: false,
      }),
    ).toBeNull();
    expect(readCapacityDiagnostic(conflicting)).toEqual({
      effectiveCapacity: 10,
      conflict: { capacity: 10, maxParticipants: 20 },
      invalid: false,
      unusable: false,
    });
  });

  it('uses a valid transitional value while flagging the invalid stored value', () => {
    expect(
      readCapacityDiagnostic({
        capacity: 0,
        registration: { maxParticipants: 20 },
      }),
    ).toEqual({
      effectiveCapacity: 20,
      invalid: true,
      unusable: false,
    });
  });

  it('rejects direct compatibility writes on conflicts', () => {
    expect(() =>
      buildCapacityUpdate({
        event: conflicting,
        directCapacityPresent: true,
        directCapacity: 10,
      }),
    ).toThrow(ConflictException);
  });

  it('resolves only an exact expected conflict snapshot', () => {
    expect(
      buildCapacityUpdate({
        event: conflicting,
        directCapacityPresent: false,
        mutation: {
          action: 'use_legacy',
          expectedConflict: { capacity: 10, maxParticipants: 20 },
        },
      }),
    ).toEqual({ set: 20, clear: false });
    expect(() =>
      buildCapacityUpdate({
        event: conflicting,
        directCapacityPresent: false,
        mutation: {
          action: 'clear',
          expectedConflict: { capacity: 10, maxParticipants: 21 },
        },
      }),
    ).toThrow(ConflictException);
  });
});
