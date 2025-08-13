import { Module } from '@nestjs/common';
import { CompaniesModule } from './companies/companies.module';
import { RoomsModule } from './rooms/rooms.module';
import { SchedulesModule } from './schedules/schedules.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [CompaniesModule, RoomsModule, SchedulesModule, BookingsModule],
  exports: [CompaniesModule, RoomsModule, SchedulesModule, BookingsModule],
})
export class BookingSystemModule {}
