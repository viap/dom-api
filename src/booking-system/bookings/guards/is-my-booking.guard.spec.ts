import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@/roles/enums/roles.enum';
import { BookingsService } from '../bookings.service';
import { IS_MY_BOOKING_KEY } from '../decorators/is-my-booking.decorator';
import { IsMyBookingGuard } from './is-my-booking.guard';

describe('IsMyBookingGuard', () => {
  let guard: IsMyBookingGuard;
  let bookingsService: { findOne: jest.Mock };

  function run(roles: Role[], params: Record<string, string>) {
    const request = { userContext: { userId: 'me', roles }, params };
    return guard.canActivate({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext);
  }

  beforeEach(() => {
    bookingsService = {
      findOne: jest.fn().mockResolvedValue({ bookedBy: { _id: 'someone' } }),
    };
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => key === IS_MY_BOOKING_KEY),
    } as unknown as Reflector;
    guard = new IsMyBookingGuard(
      reflector,
      bookingsService as unknown as BookingsService,
    );
  });

  it('lets admins reach any booking', async () => {
    await expect(run([Role.Admin], { id: 'b1' })).resolves.toBe(true);
  });

  it.each([Role.Editor, Role.Tenant])(
    'does not let %s reach someone else’s booking',
    async (role) => {
      await expect(run([role], { id: 'b1' })).resolves.toBe(false);
    },
  );

  it('denies owner-only routes without an id', async () => {
    await expect(run([Role.Tenant], {})).resolves.toBe(false);
  });
});
