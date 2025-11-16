import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: jest.Mocked<AuthService>;
  let reflector: jest.Mocked<Reflector>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(() => {
    authService = {
      verifyToken: jest.fn(),
    } as any;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    usersService = {
      getById: jest.fn(),
    } as any;

    guard = new AuthGuard(authService, reflector, usersService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });
});
