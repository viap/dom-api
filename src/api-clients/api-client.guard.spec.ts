import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiClientGuard } from './api-client.guard';

describe('ApiClientGuard', () => {
  const previousEnv = {
    BOT_CLIENT_NAME: process.env.BOT_CLIENT_NAME,
    BOT_CLIENT_PASSWORD: process.env.BOT_CLIENT_PASSWORD,
    WEB_CLIENT_NAME: process.env.WEB_CLIENT_NAME,
    WEB_CLIENT_PASSWORD: process.env.WEB_CLIENT_PASSWORD,
  };

  function context(body: unknown): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ body }) }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  }

  afterAll(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it.each([
    ['BOT', 'bot-client', 'bot-secret'],
    ['WEB', 'web-client', 'web-secret'],
  ] as const)(
    'accepts valid %s credentials before pipes run',
    (kind, name, password) => {
      process.env[`${kind}_CLIENT_NAME`] = name;
      process.env[`${kind}_CLIENT_PASSWORD`] = password;
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(kind),
      } as unknown as Reflector;
      const guard = new ApiClientGuard(reflector);

      expect(
        guard.canActivate(context({ apiClient: { name, password } })),
      ).toBe(true);
    },
  );

  it('rejects missing or invalid credentials for a protected route', () => {
    process.env.BOT_CLIENT_NAME = 'bot-client';
    process.env.BOT_CLIENT_PASSWORD = 'bot-secret';
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('BOT'),
    } as unknown as Reflector;
    const guard = new ApiClientGuard(reflector);

    expect(() => guard.canActivate(context({}))).toThrow(UnauthorizedException);
    expect(() =>
      guard.canActivate(
        context({ apiClient: { name: 'bot-client', password: 'wrong' } }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('does not require service credentials on unannotated routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new ApiClientGuard(reflector);

    expect(guard.canActivate(context(undefined))).toBe(true);
  });
});
