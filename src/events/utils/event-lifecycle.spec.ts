import { EventStatus } from '../enums/event-status.enum';
import {
  isPublicEventLifecycle,
  normalizeEffectiveLifecycle,
} from './event-lifecycle';

describe('Event lifecycle normalization', () => {
  it.each(['planned', 'registration_open', 'ongoing'])(
    'normalizes %s to active',
    (status) => {
      expect(normalizeEffectiveLifecycle(status)).toBe(EventStatus.Active);
    },
  );

  it('fails closed for missing and unknown lifecycle values', () => {
    expect(normalizeEffectiveLifecycle(undefined)).toBe('invalid');
    expect(normalizeEffectiveLifecycle('mystery')).toBe('invalid');
    expect(isPublicEventLifecycle('mystery')).toBe(false);
    expect(isPublicEventLifecycle(EventStatus.Draft)).toBe(false);
  });
});
