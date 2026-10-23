import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHash } from 'crypto';

type LoginAttemptState = {
  failedCount: number;
  firstFailedAt: number;
  lockedUntil?: number;
};

type LoginAttemptResult = {
  locked: boolean;
  lockedUntil?: number;
  retryAfterSeconds?: number;
};

type LockedState = {
  locked: boolean;
  lockedUntil?: number;
  retryAfterSeconds?: number;
};

type LockoutPolicy = {
  windowMs: number;
  maxFailedAttempts: number;
  lockoutMs: number;
};

// Two counters: per client IP + login (5 failures in 15 min), and a backstop
// per login across all IPs (30 failures per hour) that caps brute force even
// when the attacker rotates or spoofs IPs. The backstop is not reset by a
// successful login so it keeps capping an ongoing attack.
// ponytail: in-memory and per process; correct only with a single pm2 fork.
@Injectable()
export class AuthLoginAttemptsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthLoginAttemptsService.name);
  private readonly attempts = new Map<string, LoginAttemptState>();
  private readonly loginAttempts = new Map<string, LoginAttemptState>();
  private readonly ipPolicy: LockoutPolicy = {
    windowMs: 15 * 60 * 1000,
    maxFailedAttempts: 5,
    lockoutMs: 15 * 60 * 1000,
  };
  private readonly loginPolicy: LockoutPolicy = {
    windowMs: 60 * 60 * 1000,
    maxFailedAttempts: 30,
    lockoutMs: 15 * 60 * 1000,
  };
  private readonly cleanupIntervalMs = 5 * 60 * 1000;
  private readonly maxTrackedKeys = 10_000;
  private cleanupTimer?: NodeJS.Timeout;

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      this.evictExpiredEntries();
    }, this.cleanupIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  isLocked(
    sourceIp: string,
    normalizedLogin: string,
    now = Date.now(),
  ): boolean {
    return this.getLockedState(sourceIp, normalizedLogin, now).locked;
  }

  getLockedState(
    sourceIp: string,
    normalizedLogin: string,
    now = Date.now(),
  ): LockedState {
    if (!this.shouldTrack(sourceIp, normalizedLogin)) {
      return { locked: false };
    }

    return this.longerLock(
      this.readState(
        this.attempts,
        this.makeKey(sourceIp, normalizedLogin),
        this.ipPolicy,
        now,
      ),
      this.readState(
        this.loginAttempts,
        normalizedLogin,
        this.loginPolicy,
        now,
      ),
    );
  }

  registerFailure(
    sourceIp: string,
    normalizedLogin: string,
    now = Date.now(),
  ): LoginAttemptResult {
    if (!this.shouldTrack(sourceIp, normalizedLogin)) {
      return { locked: false };
    }

    const ipResult = this.recordFailure(
      this.attempts,
      this.makeKey(sourceIp, normalizedLogin),
      this.ipPolicy,
      now,
    );
    const wasLoginLocked = this.isLockedIn(
      this.loginAttempts,
      normalizedLogin,
      now,
    );
    const loginResult = this.recordFailure(
      this.loginAttempts,
      normalizedLogin,
      this.loginPolicy,
      now,
    );

    if (loginResult.locked && !wasLoginLocked) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.login.backstop_locked',
          loginFingerprint: createHash('sha256')
            .update(normalizedLogin)
            .digest('hex')
            .slice(0, 16),
        }),
      );
    }

    return this.longerLock(ipResult, loginResult);
  }

  reset(sourceIp: string, normalizedLogin: string): void {
    if (!this.shouldTrack(sourceIp, normalizedLogin)) {
      return;
    }
    this.attempts.delete(this.makeKey(sourceIp, normalizedLogin));
  }

  private readState(
    map: Map<string, LoginAttemptState>,
    key: string,
    policy: LockoutPolicy,
    now: number,
  ): LockedState {
    const state = map.get(key);

    if (!state) {
      return { locked: false };
    }

    if (state.lockedUntil && state.lockedUntil > now) {
      return {
        locked: true,
        lockedUntil: state.lockedUntil,
        retryAfterSeconds: this.getRetryAfterSeconds(state.lockedUntil, now),
      };
    }

    if (
      (state.lockedUntil && state.lockedUntil <= now) ||
      now - state.firstFailedAt > policy.windowMs
    ) {
      map.delete(key);
    }

    return { locked: false };
  }

  private recordFailure(
    map: Map<string, LoginAttemptState>,
    key: string,
    policy: LockoutPolicy,
    now: number,
  ): LoginAttemptResult {
    const current = map.get(key);

    if (current?.lockedUntil && current.lockedUntil > now) {
      return {
        locked: true,
        lockedUntil: current.lockedUntil,
        retryAfterSeconds: this.getRetryAfterSeconds(current.lockedUntil, now),
      };
    }

    if (
      !current ||
      current.lockedUntil ||
      now - current.firstFailedAt > policy.windowMs
    ) {
      this.evictOldestIfFull(map);
      map.set(key, {
        failedCount: 1,
        firstFailedAt: now,
      });
      return { locked: false };
    }

    const failedCount = current.failedCount + 1;
    const nextState: LoginAttemptState = {
      ...current,
      failedCount,
    };

    // Lockout semantics: the Nth failed credential is recorded and triggers
    // lock state; subsequent attempts are blocked by pre-check.
    if (failedCount >= policy.maxFailedAttempts) {
      nextState.lockedUntil = now + policy.lockoutMs;
      map.set(key, nextState);
      return {
        locked: true,
        lockedUntil: nextState.lockedUntil,
        retryAfterSeconds: this.getRetryAfterSeconds(
          nextState.lockedUntil,
          now,
        ),
      };
    }

    map.set(key, nextState);
    return { locked: false };
  }

  private isLockedIn(
    map: Map<string, LoginAttemptState>,
    key: string,
    now: number,
  ): boolean {
    const lockedUntil = map.get(key)?.lockedUntil;
    return !!lockedUntil && lockedUntil > now;
  }

  private longerLock(first: LockedState, second: LockedState): LockedState {
    if (!second.locked) {
      return first;
    }
    if (!first.locked) {
      return second;
    }
    return (first.lockedUntil ?? 0) >= (second.lockedUntil ?? 0)
      ? first
      : second;
  }

  // Map keeps insertion order, so the first key is the oldest entry.
  private evictOldestIfFull(map: Map<string, LoginAttemptState>): void {
    if (map.size >= this.maxTrackedKeys) {
      const oldestKey = map.keys().next().value;
      if (oldestKey !== undefined) {
        map.delete(oldestKey);
      }
    }
  }

  private makeKey(sourceIp: string, normalizedLogin: string): string {
    return `${sourceIp}|${normalizedLogin}`;
  }

  private shouldTrack(sourceIp: string, normalizedLogin: string): boolean {
    return Boolean(sourceIp && normalizedLogin);
  }

  private getRetryAfterSeconds(lockedUntil: number, now: number): number {
    const seconds = Math.ceil((lockedUntil - now) / 1000);
    return seconds > 0 ? seconds : 0;
  }

  private evictExpiredEntries(now = Date.now()): void {
    const sweep = (
      map: Map<string, LoginAttemptState>,
      policy: LockoutPolicy,
    ) => {
      for (const [key, state] of map.entries()) {
        const lockExpired = state.lockedUntil && state.lockedUntil <= now;
        const windowExpired = now - state.firstFailedAt > policy.windowMs;

        if (lockExpired || windowExpired) {
          map.delete(key);
        }
      }
    };

    sweep(this.attempts, this.ipPolicy);
    sweep(this.loginAttempts, this.loginPolicy);
  }
}
