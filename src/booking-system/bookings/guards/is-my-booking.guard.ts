import { EnhancedRequest } from '@/common/types/enhanced-request.interface';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserContext } from '../../../common/user-context/user-context.interface';
import { includesOther } from '../../../common/utils/includes-other';
import { ROLES_KEY } from '../../../roles/decorators/role.docorator';
import { Role } from '../../../roles/enums/roles.enum';
import { BookingsService } from '../bookings.service';
import { IS_MY_BOOKING_KEY } from '../decorators/is-my-booking.decorator';

@Injectable()
export class IsMyBookingGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private bookingsService: BookingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<EnhancedRequest>();
    const shouldBeMyBooking =
      this.reflector.getAllAndOverride<boolean>(IS_MY_BOOKING_KEY, [
        context.getHandler(),
      ]) || false;

    const requiredRoles =
      this.reflector.getAllAndOverride<Array<Role>>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (shouldBeMyBooking) {
      try {
        if (!request.userContext) {
          return false;
        }

        const params = request.params || {};

        // NOTICE: check if user has any required role except regular user roles
        // Admins can access any booking
        if (
          includesOther<Role>(requiredRoles, request.userContext.roles, [
            Role.User,
          ])
        ) {
          return true;
        }

        // Allow admins to access any booking
        if (request.userContext.roles.includes(Role.Admin)) {
          return true;
        }

        // For user-specific endpoints like /by-user/:userId
        if (params.userId) {
          return request.userContext.userId === params.userId;
        }

        // For booking-specific endpoints like /:id
        if (params.id) {
          return this.checkIfIsMyBooking(request.userContext, params.id);
        }

        return true;
      } catch {
        return false;
      }
    }

    return true;
  }

  async checkIfIsMyBooking(
    userContext: UserContext,
    bookingId: string | undefined,
  ): Promise<boolean> {
    if (!bookingId) {
      return false;
    }

    try {
      const booking = await this.bookingsService.findOne(bookingId);
      if (!booking) {
        return false;
      }

      // Admin can access any booking
      if (userContext.roles.includes(Role.Admin)) {
        return true;
      }

      // Regular users can only access their own bookings
      return booking.bookedBy._id.toString() === userContext.userId;
    } catch {
      return false;
    }
  }
}
