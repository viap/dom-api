import { normalizeLogin } from './normalize-login';

describe('normalizeLogin', () => {
  it('returns empty string for non-string values', () => {
    expect(normalizeLogin(undefined)).toBe('');
    expect(normalizeLogin(null)).toBe('');
    expect(normalizeLogin('')).toBe('');
  });

  it('trims and lowercases login values', () => {
    expect(normalizeLogin('  VBiRIlov  ')).toBe('vbirilov');
  });
});
