import { Test, TestingModule } from '@nestjs/testing';
import { AuthLoginAttemptsService } from './auth-login-attempts.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthFailureError } from './errors/auth-failure.error';
import { AuthFailureReason } from './enums/auth-failure-reason.enum';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;
  let mockAuthLoginAttemptsService: any;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeEach(async () => {
    mockAuthService = {
      signInByTelegram: jest.fn(),
      signInByAuthUser: jest.fn(),
      logAuthFailure: jest.fn(),
    };
    mockAuthLoginAttemptsService = {
      isLocked: jest.fn(),
      getLockedState: jest.fn(),
      registerFailure: jest.fn(),
      reset: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: AuthLoginAttemptsService,
          useValue: mockAuthLoginAttemptsService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns 429 and Retry-After when login is locked', async () => {
    mockAuthLoginAttemptsService.getLockedState.mockReturnValue({
      locked: true,
      lockedUntil: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });

    const request = {
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'jest',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    const response = { setHeader: jest.fn() } as any;

    await controller
      .getAuthTokenForUser(
        {
          apiClient: { name: 'domWeb', password: 'secret' },
          user: { login: 'vbirilov', password: 'pass' },
        },
        request,
        response,
        'f8db8a42-04ca-4f59-95a5-779c20f8798e',
      )
      .catch((error) => {
        expect(error.getStatus()).toBe(429);
        expect(error.getResponse()).toEqual({
          message: 'Too many failed attempts',
          retryAfterSeconds: 60,
        });
      });

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(mockAuthService.logAuthFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: AuthFailureReason.InvalidUserCredentials,
        locked: true,
      }),
    );
  });

  it('returns 429 and Retry-After when telegram login is locked', async () => {
    mockAuthLoginAttemptsService.getLockedState.mockReturnValue({
      locked: true,
      lockedUntil: Date.now() + 45_000,
      retryAfterSeconds: 45,
    });

    const request = {
      headers: {
        'user-agent': 'jest',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    const response = { setHeader: jest.fn() } as any;

    await controller
      .getAuthTokenForTelegram(
        {
          apiClient: { name: 'domWeb', password: 'secret' },
          telegram: { id: '123456', username: 'tester' },
        } as any,
        request,
        response,
        'f8db8a42-04ca-4f59-95a5-779c20f8798e',
      )
      .catch((error) => {
        expect(error.getStatus()).toBe(429);
        expect(error.getResponse()).toEqual({
          message: 'Too many failed attempts',
          retryAfterSeconds: 45,
        });
      });

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '45');
    expect(mockAuthService.signInByTelegram).not.toHaveBeenCalled();
  });

  it('keeps invalid credentials as generic 401 when not locked', async () => {
    mockAuthLoginAttemptsService.getLockedState.mockReturnValue({
      locked: false,
    });
    mockAuthService.signInByAuthUser.mockRejectedValue(
      new AuthFailureError(AuthFailureReason.InvalidUserCredentials),
    );
    mockAuthLoginAttemptsService.registerFailure.mockReturnValue({
      locked: false,
    });

    const request = {
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'jest',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    const response = { setHeader: jest.fn() } as any;

    await expect(
      controller.getAuthTokenForUser(
        {
          apiClient: { name: 'domWeb', password: 'secret' },
          user: { login: 'vbirilov', password: 'pass' },
        },
        request,
        response,
      ),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it('sanitizes invalid request-id header before passing metadata to auth service', async () => {
    mockAuthLoginAttemptsService.getLockedState.mockReturnValue({
      locked: false,
    });
    mockAuthService.signInByAuthUser.mockResolvedValue({ auth_token: 'token' });

    const request = {
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'jest',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    const response = { setHeader: jest.fn() } as any;

    await controller.getAuthTokenForUser(
      {
        apiClient: { name: 'domWeb', password: 'secret' },
        user: { login: 'vbirilov', password: 'pass' },
      },
      request,
      response,
      'bad-id\nwith-injection',
    );

    expect(mockAuthService.signInByAuthUser).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        requestId: expect.stringMatching(uuidRegex),
      }),
    );
  });
});
