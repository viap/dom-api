import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Role } from '@/roles/enums/roles.enum';
import { UsersService } from '@/users/users.service';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: jest.Mocked<AuthService>;
  let usersService: jest.Mocked<UsersService>;
  let reflector: jest.Mocked<Reflector>;

  function createContext(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    authService = {
      verifyToken: jest.fn(),
    } as any;

    usersService = {
      getById: jest.fn(),
    } as any;

    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as any;

    guard = new AuthGuard(authService, reflector, usersService);
  });

  it('uses current database roles instead of token roles', async () => {
    authService.verifyToken.mockResolvedValue({
      userId: 'user-id',
      roles: [Role.Admin],
      clientName: 'domWeb',
    });
    const user = { _id: 'user-id', roles: [Role.User] };
    usersService.getById.mockResolvedValue(user as any);
    const request: Record<string, any> = {
      headers: { authorization: 'Bearer token' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toBe(user);
    expect(request.userContext).toEqual({
      userId: 'user-id',
      roles: [Role.User],
      clientName: 'domWeb',
    });
  });

  it('rejects tokens of deleted users', async () => {
    authService.verifyToken.mockResolvedValue({
      userId: 'user-id',
      roles: [Role.Admin],
    });
    usersService.getById.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: 'Bearer token' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid tokens without a database lookup', async () => {
    authService.verifyToken.mockResolvedValue(undefined);

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: 'Bearer token' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(usersService.getById).not.toHaveBeenCalled();
  });
});
