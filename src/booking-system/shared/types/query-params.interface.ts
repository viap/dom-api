import { BookingStatus } from '../../bookings/enums/booking-status.enum';

export interface BookingQueryParams {
  room?: string;
  roomIds?: string[];
  bookedBy?: string;
  status?: BookingStatus;
  startDate?: string;
  endDate?: string;
  includeChildBookings?: string;
  sortBy?: 'created' | 'startDateTime';
  sortOrder?: 'asc' | 'desc';
  limit?: string;
  upcoming?: string;
  [key: string]: string | string[] | undefined;
}

export interface CompanyQueryParams {
  isActive?: string;
  name?: string;
  [key: string]: string | string[] | undefined;
}

export interface RoomQueryParams {
  company?: string;
  isActive?: string;
  name?: string;
  minCapacity?: string;
  maxCapacity?: string;
  amenities?: string | string[];
  [key: string]: string | string[] | undefined;
}

export interface ScheduleQueryParams {
  room?: string;
  company?: string;
  type?: string;
  isActive?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: string | string[] | undefined;
}
