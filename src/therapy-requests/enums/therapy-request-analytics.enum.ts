export enum TherapyRequestClientGender {
  Female = 'female',
  Male = 'male',
  Other = 'other',
  Unknown = 'unknown',
}

export enum TherapyRequestCategory {
  Individual = 'individual',
  Family = 'family',
  Group = 'group',
  Child = 'child',
  Unknown = 'unknown',
}

export const therapyRequestAnalyticsFields = [
  'clientGender',
  'requestCategory',
] as const;

export type TherapyRequestAnalyticsField =
  (typeof therapyRequestAnalyticsFields)[number];
