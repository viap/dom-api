import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

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

@Injectable()
export class AuthLoginAttemptsService implements OnModuleInit, OnModuleDestroy {
  private readonly attempts = new Map<string, LoginAttemptState>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly lockoutMs = 15 * 60 * 1000;
  private readonly maxFailedAttempts = 5;
  private readonly cleanupIntervalMs = 5 * 60 * 1000;
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

    const key = this.makeKey(sourceIp, normalizedLogin);
    const state = this.attempts.get(key);

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

    if (state.lockedUntil && state.lockedUntil <= now) {
      this.attempts.delete(key);
      return { locked: false };
    }

    if (now - state.firstFailedAt > this.windowMs) {
      this.attempts.delete(key);
      return { locked: false };
    }

    return { locked: false };
  }

  registerFailure(
    sourceIp: string,
    normalizedLogin: string,
    now = Date.now(),
  ): LoginAttemptResult {
    if (!this.shouldTrack(sourceIp, normalizedLogin)) {
      return { locked: false };
    }

    const key = this.makeKey(sourceIp, normalizedLogin);
    const current = this.attempts.get(key);

    if (current?.lockedUntil && current.lockedUntil > now) {
      return {
        locked: true,
        lockedUntil: current.lockedUntil,
        retryAfterSeconds: this.getRetryAfterSeconds(current.lockedUntil, now),
      };
    }

    if (!current || now - current.firstFailedAt > this.windowMs) {
      this.attempts.set(key, {
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

    // Lockout semantics: the 5th failed credential is recorded and triggers
    // lock state; subsequent attempts (6th+) are blocked by pre-check.
    if (failedCount >= this.maxFailedAttempts) {
      nextState.lockedUntil = now + this.lockoutMs;
      this.attempts.set(key, nextState);
      return {
        locked: true,
        lockedUntil: nextState.lockedUntil,
        retryAfterSeconds: this.getRetryAfterSeconds(
          nextState.lockedUntil,
          now,
        ),
      };
    }

    this.attempts.set(key, nextState);
    return { locked: false };
  }

  reset(sourceIp: string, normalizedLogin: string): void {
    if (!this.shouldTrack(sourceIp, normalizedLogin)) {
      return;
    }
    const key = this.makeKey(sourceIp, normalizedLogin);
    this.attempts.delete(key);
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
    for (const [key, state] of this.attempts.entries()) {
      const lockExpired = state.lockedUntil && state.lockedUntil <= now;
      const windowExpired = now - state.firstFailedAt > this.windowMs;

      if (lockExpired || windowExpired) {
        this.attempts.delete(key);
      }
    }
  }
}
