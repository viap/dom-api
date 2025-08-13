import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking, bookingSchema } from './schemas/booking.schema';
import { RoomsModule } from '../rooms/rooms.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Booking.name, schema: bookingSchema }]),
    RoomsModule,
    SchedulesModule,
    UsersModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
