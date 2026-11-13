export interface CapacityConflictSnapshot {
  capacity?: number;
  maxParticipants?: number;
}

export type CapacityMutation =
  | {
      action: 'set';
      value: number;
      expectedConflict?: CapacityConflictSnapshot;
    }
  | { action: 'clear'; expectedConflict?: CapacityConflictSnapshot }
  | { action: 'use_legacy'; expectedConflict: CapacityConflictSnapshot };

export interface CapacityDiagnostic {
  effectiveCapacity?: number;
  conflict?: CapacityConflictSnapshot;
  invalid: boolean;
}
