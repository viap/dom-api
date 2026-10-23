import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';

class TestController {
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  limited() {
    return true;
  }

  open() {
    return true;
  }
}

describe('AppThrottlerGuard', () => {
  const originalEnv = { ...process.env };
  let guard: AppThrottlerGuard;
  let jwtService: { verify: jest.Mock };

  beforeEach(() => {
    process.env.BOT_CLIENT_NAME = 'domBot';
    process.env.BOT_CLIENT_PASSWORD = 'bot-secret';
    jwtService = { verify: jest.fn() };
    guard = new AppThrottlerGuard(
      [{ ttl: 60000, limit: 300 }],
      {} as any,
      new Reflector(),
      jwtService as unknown as JwtService,
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const tracker = (req: Record<string, any>) =>
    (guard as any).getTracker({ ip: '10.0.0.1', headers: {}, ...req });

  it('tracks verified users by id', async () => {
    jwtService.verify.mockReturnValue({ userId: 'u1' });
    await expect(
      tracker({ headers: { authorization: 'Bearer t' } }),
    ).resolves.toBe('user:u1');
  });

  it('tracks forged tokens by IP', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });
    await expect(
      tracker({ headers: { authorization: 'Bearer forged' } }),
    ).resolves.toBe('ip:10.0.0.1');
  });

  it('tracks bot logins per Telegram id only for the real bot client', async () => {
    const body = (password: string) => ({
      apiClient: { name: 'domBot', password },
      telegram: { id: '42' },
    });

    await expect(tracker({ body: body('bot-secret') })).resolves.toBe(
      'telegram:42',
    );
    await expect(tracker({ body: body('guess') })).resolves.toBe('ip:10.0.0.1');
  });

  describe('shouldSkip', () => {
    const context = (
      method: string,
      handler: keyof TestController,
      headers = {},
    ) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
        getHandler: () => TestController.prototype[handler],
        getClass: () => TestController,
      } as unknown as ExecutionContext);

    it.each([
      ['GET', 'open', {}, true],
      ['GET', 'limited', {}, false],
      ['POST', 'open', {}, false],
      ['GET', 'open', { authorization: 'Bearer t' }, false],
    ] as const)(
      '%s %s with %p headers -> skip %p',
      async (method, handler, headers, expected) => {
        await expect(
          (guard as any).shouldSkip(context(method, handler, headers)),
        ).resolves.toBe(expected);
      },
    );
  });
});
