import { AuthLoginAttemptsService } from './auth-login-attempts.service';

describe('AuthLoginAttemptsService', () => {
  let service: AuthLoginAttemptsService;

  beforeEach(() => {
    service = new AuthLoginAttemptsService();
  });

  it('locks after 5 failed attempts in 15-minute window', () => {
    const now = Date.now();
    const sourceIp = '127.0.0.1';
    const login = 'vbirilov';

    for (let i = 0; i < 4; i += 1) {
      const result = service.registerFailure(sourceIp, login, now + i * 1000);
      expect(result.locked).toBe(false);
      expect(service.isLocked(sourceIp, login, now + i * 1000)).toBe(false);
    }

    const fifthResult = service.registerFailure(sourceIp, login, now + 5000);
    expect(fifthResult.locked).toBe(true);
    expect(service.isLocked(sourceIp, login, now + 5000)).toBe(true);
  });

  it('starts lockout after the 5th failed attempt, so the 6th is blocked', () => {
    const now = Date.now();
    const sourceIp = '127.0.0.1';
    const login = 'vbirilov';

    for (let i = 0; i < 5; i += 1) {
      service.registerFailure(sourceIp, login, now + i * 1000);
    }

    expect(service.isLocked(sourceIp, login, now + 5000)).toBe(true);
  });

  it('unlocks after lockout window passes', () => {
    const now = Date.now();
    const sourceIp = '127.0.0.1';
    const login = 'vbirilov';

    for (let i = 0; i < 5; i += 1) {
      service.registerFailure(sourceIp, login, now + i * 1000);
    }

    expect(service.isLocked(sourceIp, login, now + 5000)).toBe(true);

    const afterLockoutWindow = now + 16 * 60 * 1000;
    expect(service.isLocked(sourceIp, login, afterLockoutWindow)).toBe(false);
  });

  it('resets rolling window when first failure expires', () => {
    const now = Date.now();
    const sourceIp = '127.0.0.1';
    const login = 'vbirilov';

    service.registerFailure(sourceIp, login, now);
    service.registerFailure(sourceIp, login, now + 1000);

    // Beyond 15-minute window should reset counter to 1.
    const result = service.registerFailure(sourceIp, login, now + 16 * 60 * 1000);
    expect(result.locked).toBe(false);
    expect(service.isLocked(sourceIp, login, now + 16 * 60 * 1000)).toBe(false);
  });

  it('does not register failures for missing login/sourceIp', () => {
    const now = Date.now();

    expect(service.registerFailure('', 'vbirilov', now).locked).toBe(false);
    expect(service.registerFailure('127.0.0.1', '', now).locked).toBe(false);
    expect(service.isLocked('', 'vbirilov', now)).toBe(false);
    expect(service.isLocked('127.0.0.1', '', now)).toBe(false);
  });

  it('evicts expired entries on periodic cleanup', () => {
    jest.useFakeTimers();
    const base = new Date('2026-01-01T00:00:00.000Z');
    jest.setSystemTime(base);

    const baseMs = base.getTime();
    service.registerFailure('127.0.0.1', 'expired-user', baseMs - 16 * 60 * 1000);
    service.registerFailure('127.0.0.1', 'active-user', baseMs);

    service.onModuleInit();
    jest.advanceTimersByTime(5 * 60 * 1000);

    const attempts = (service as any).attempts as Map<string, unknown>;
    expect(attempts.has('127.0.0.1|expired-user')).toBe(false);
    expect(attempts.has('127.0.0.1|active-user')).toBe(true);

    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('stops cleanup timer on module destroy', () => {
    jest.useFakeTimers();

    service.onModuleInit();
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);

    jest.useRealTimers();
  });
});
