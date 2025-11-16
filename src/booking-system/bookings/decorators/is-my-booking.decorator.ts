import { SetMetadata } from '@nestjs/common';

export const IS_MY_BOOKING_KEY = 'isMyBooking';
export const IsMyBooking = () => SetMetadata(IS_MY_BOOKING_KEY, true);
