import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { BookingsController } from './bookings/bookings.controller';
import { CompaniesController } from './companies/companies.controller';
import { RoomsController } from './rooms/rooms.controller';
import { SchedulesController } from './schedules/schedules.controller';

describe('booking-system access', () => {
  it.each([
    BookingsController,
    CompaniesController,
    RoomsController,
    SchedulesController,
  ])('%p is admin-only', (controller) => {
    expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual([Role.Admin]);
  });
});
