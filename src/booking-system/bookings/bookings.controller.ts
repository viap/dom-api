import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JoiValidationPipe } from '../../joi/joi.pipe';
import { Roles } from '../../roles/decorators/role.docorator';
import { Role } from '../../roles/enums/roles.enum';
import { BookingQueryParams } from '../shared/types/query-params.interface';
import { BookingsService } from './bookings.service';
import { IsMyBooking } from './decorators/is-my-booking.decorator';
import { createBookingSchema } from './schemas/joi.create-booking.schema';
import { updateBookingSchema } from './schemas/joi.update-booking.schema';

import { UserDocument } from '../../users/schemas/user.schema';
import { ApproveBookingDto } from './dto/approve-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { IsMyBookingGuard } from './guards/is-my-booking.guard';

@Controller('booking-system/bookings')
@UseGuards(IsMyBookingGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * Create a new booking
   * @param createBookingDto Booking data
   * @param req Request object containing user info
   * @returns Created booking
   *
   * Example request:
   * POST /booking-system/bookings
   * {
   *   "title": "Team Meeting",
   *   "description": "Weekly team sync meeting",
   *   "room": "507f1f77bcf86cd799439012",
   *   "bookedBy": "507f1f77bcf86cd799439014",
   *   "startDateTime": "2024-02-15T10:00:00.000Z",
   *   "endDateTime": "2024-02-15T11:00:00.000Z",
   *   "attendees": ["john@example.com", "jane@example.com"],
   *   "metadata": {
   *     "purpose": "Team synchronization",
   *     "department": "Engineering",
   *     "estimatedAttendees": 8
   *   },
   *   "equipmentRequests": {
   *     "projector": true,
   *     "videoConferencing": true
   *   }
   * }
   *
   * Example recurring booking:
   * POST /booking-system/bookings
   * {
   *   "title": "Weekly Team Meeting",
   *   "room": "507f1f77bcf86cd799439012",
   *   "bookedBy": "507f1f77bcf86cd799439014",
   *   "startDateTime": "2024-02-15T10:00:00.000Z",
   *   "endDateTime": "2024-02-15T11:00:00.000Z",
   *   "recurrenceType": "weekly",
   *   "daysOfWeek": [4],
   *   "recurrenceEndDate": "2024-05-15T10:00:00.000Z"
   * }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() req,
    @Body(new JoiValidationPipe(createBookingSchema))
    createBookingDto: CreateBookingDto,
  ) {
    const user = req.user as UserDocument;

    // If bookedBy is not provided, default to current user
    if (!createBookingDto.bookedBy) {
      createBookingDto.bookedBy = user._id.toString();
    } else if (createBookingDto.bookedBy !== user._id.toString()) {
      // Only admins can create bookings for other users
      if (!user.roles.includes(Role.Admin)) {
        throw new ForbiddenException(
          'Only administrators can create bookings on behalf of other users',
        );
      }
    }

    return this.bookingsService.create(createBookingDto, user);
  }

  /**
   * Get all bookings with optional filtering
   * @param query Query parameters for filtering
   * @returns Array of bookings
   *
   * Example requests:
   * GET /booking-system/bookings
   * GET /booking-system/bookings?room=507f1f77bcf86cd799439012
   * GET /booking-system/bookings?status=confirmed
   * GET /booking-system/bookings?startDate=2024-02-01&endDate=2024-02-28
   * GET /booking-system/bookings?bookedBy=507f1f77bcf86cd799439014
   */
  @Get()
  findAll(@Query() query: BookingQueryParams) {
    return this.bookingsService.findAll(query);
  }

  /**
   * Export bookings for a date range and selected rooms
   * @param query Export parameters
   * @returns Booking export data
   *
   * Example request:
   * GET /booking-system/bookings/export?startDate=2024-02-01&endDate=2024-02-28&roomIds=507f1f77bcf86cd799439012,507f1f77bcf86cd799439013
   */
  @Get('export')
  @Roles(Role.Admin)
  exportBookings(@Query() query: BookingQueryParams) {
    return this.bookingsService.exportBookings(query);
  }

  /**
   * Get booking statistics
   * @param query Query parameters for date range
   * @returns Booking statistics
   *
   * Example request:
   * GET /booking-system/bookings/stats?startDate=2024-02-01&endDate=2024-02-28
   */
  @Get('stats')
  @Roles(Role.Admin)
  getBookingStats(@Query() query: BookingQueryParams) {
    return this.bookingsService.getBookingStats(query);
  }

  /**
   * Get pending bookings for admin approval
   * @returns Array of pending bookings
   *
   * Example request:
   * GET /booking-system/bookings/pending
   */
  @Get('pending')
  @Roles(Role.Admin)
  findPendingApprovals() {
    return this.bookingsService.findPendingApprovals();
  }

  /**
   * Get upcoming bookings
   * @param query Query parameters
   * @returns Array of upcoming bookings
   *
   * Example request:
   * GET /booking-system/bookings/upcoming?days=7
   */
  @Get('upcoming')
  getUpcomingBookings(@Query() query: BookingQueryParams) {
    const userId = Array.isArray(query.userId) ? query.userId[0] : query.userId;
    const limit = query.limit
      ? parseInt(Array.isArray(query.limit) ? query.limit[0] : query.limit)
      : 10;
    return this.bookingsService.getUpcomingBookings(userId, limit);
  }

  /**
   * Check availability for a time slot
   * @param roomId Room ID
   * @param query Query parameters with date/time
   * @returns Availability status
   *
   * Example request:
   * GET /booking-system/bookings/availability/507f1f77bcf86cd799439012?startDateTime=2024-02-15T10:00:00.000Z&endDateTime=2024-02-15T11:00:00.000Z
   */
  @Get('availability/:roomId')
  checkAvailability(
    @Param('roomId') roomId: string,
    @Query() query: BookingQueryParams,
  ) {
    const startDateTime = new Date(
      Array.isArray(query.startDateTime)
        ? query.startDateTime[0]
        : query.startDateTime,
    );
    const endDateTime = new Date(
      Array.isArray(query.endDateTime)
        ? query.endDateTime[0]
        : query.endDateTime,
    );
    const excludeBookingId = Array.isArray(query.excludeBookingId)
      ? query.excludeBookingId[0]
      : query.excludeBookingId;

    return this.bookingsService.validateAvailability(
      roomId,
      startDateTime,
      endDateTime,
      excludeBookingId,
    );
  }

  /**
   * Get bookings by user
   * @param userId User ID
   * @param query Query parameters for filtering
   * @returns Array of user's bookings
   *
   * Example request:
   * GET /booking-system/bookings/by-user/507f1f77bcf86cd799439014?status=confirmed
   */
  @Get('by-user/:userId')
  @IsMyBooking()
  findByUser(
    @Param('userId') userId: string,
    @Query() query: BookingQueryParams,
  ) {
    return this.bookingsService.findByUser(userId, query);
  }

  /**
   * Get bookings by room
   * @param roomId Room ID
   * @param query Query parameters for date range
   * @returns Array of room bookings
   *
   * Example request:
   * GET /booking-system/bookings/by-room/507f1f77bcf86cd799439012?startDate=2024-02-01&endDate=2024-02-28
   */
  @Get('by-room/:roomId')
  findByRoom(
    @Param('roomId') roomId: string,
    @Query() query: BookingQueryParams,
  ) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.bookingsService.findByRoom(roomId, startDate, endDate);
  }

  /**
   * Get recurring booking series
   * @param bookingId Parent booking ID
   * @returns Array of bookings in the series
   *
   * Example request:
   * GET /booking-system/bookings/series/507f1f77bcf86cd799439015
   */
  @Get('series/:bookingId')
  getRecurringBookingSeries(@Param('bookingId') bookingId: string) {
    return this.bookingsService.getRecurringBookingSeries(bookingId);
  }

  /**
   * Get a specific booking by ID
   * @param id Booking ID
   * @returns Booking details
   *
   * Example request:
   * GET /booking-system/bookings/507f1f77bcf86cd799439015
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  /**
   * Approve a booking (Admin only)
   * @param id Booking ID
   * @param req Request object containing admin user info
   * @returns Approved booking
   *
   * Example request:
   * PATCH /booking-system/bookings/507f1f77bcf86cd799439015/approve
   */
  @Patch(':id/approve')
  @Roles(Role.Admin)
  approveBooking(@Param('id') id: string, @Request() req: any) {
    const adminUserId = req.user?.id || req.user?._id;
    return this.bookingsService.approveBooking(id, adminUserId);
  }

  /**
   * Cancel a booking
   * @param id Booking ID
   * @param body Cancellation data
   * @returns Canceled booking
   *
   * Example request:
   * PATCH /booking-system/bookings/507f1f77bcf86cd799439015/cancel
   * {
   *   "reason": "Meeting canceled due to conflicting priorities"
   * }
   */
  @Patch(':id/cancel')
  @IsMyBooking()
  cancelBooking(@Param('id') id: string, @Body() body: CancelBookingDto) {
    const reason = body.reason || 'No reason provided';
    return this.bookingsService.cancelBooking(id, reason);
  }

  /**
   * Cancel entire recurring booking series
   * @param id Parent booking ID
   * @param body Cancellation data
   * @returns Canceled bookings
   *
   * Example request:
   * PATCH /booking-system/bookings/507f1f77bcf86cd799439015/cancel-series
   * {
   *   "reason": "Project canceled"
   * }
   */
  @Patch(':id/cancel-series')
  @IsMyBooking()
  cancelRecurringSeries(
    @Param('id') id: string,
    @Body() body: CancelBookingDto,
  ) {
    const reason = body.reason || 'No reason provided';
    return this.bookingsService.cancelRecurringSeries(id, reason);
  }

  /**
   * Bulk approve bookings (Admin only)
   * @param body Array of booking IDs
   * @param req Request object containing admin user info
   * @returns Approved bookings
   *
   * Example request:
   * PATCH /booking-system/bookings/bulk-approve
   * {
   *   "bookingIds": ["507f1f77bcf86cd799439015", "507f1f77bcf86cd799439016"]
   * }
   */
  @Patch('bulk-approve')
  @Roles(Role.Admin)
  bulkApproveBookings(@Body() body: ApproveBookingDto, @Request() req: any) {
    const adminUserId = req.user?.id || req.user?._id;
    return this.bookingsService.bulkApproveBookings(
      body.bookingIds,
      adminUserId,
    );
  }

  /**
   * Update a booking
   * @param id Booking ID
   * @param updateBookingDto Updated booking data
   * @returns Updated booking
   *
   * Example request:
   * PATCH /booking-system/bookings/507f1f77bcf86cd799439015
   * {
   *   "title": "Updated Team Meeting",
   *   "description": "Weekly team sync with additional agenda items",
   *   "attendees": ["john@example.com", "jane@example.com", "bob@example.com"],
   *   "metadata": {
   *     "estimatedAttendees": 10
   *   }
   * }
   */
  @Patch(':id')
  @IsMyBooking()
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateBookingSchema))
    updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  /**
   * Delete a booking
   * @param id Booking ID
   *
   * Example request:
   * DELETE /booking-system/bookings/507f1f77bcf86cd799439015
   */
  @Delete(':id')
  @IsMyBooking()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
