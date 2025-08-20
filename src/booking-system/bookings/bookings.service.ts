import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  safeFindParams,
  sanitizeDateRange,
  validateObjectId,
} from '../../common/utils/mongo-sanitizer';
import { Role } from '../../roles/enums/roles.enum';
import { UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';
import { RoomsService } from '../rooms/rooms.service';
import { SchedulesService } from '../schedules/schedules.service';
import { BookingQueryParams } from '../shared/types/query-params.interface';
import {
  RecurrenceCalculator,
  RecurrenceOptions,
} from '../shared/utils/recurrence-calculator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingStatus } from './enums/booking-status.enum';
import { RecurrenceType } from './enums/recurrence-type.enum';
import { Booking, BookingDocument } from './schemas/booking.schema';

const submodels = [
  {
    path: 'room',
    select: 'name capacity location amenities',
    populate: {
      path: 'company',
      select: 'name address',
    },
  },
  {
    path: 'bookedBy',
    select: 'name contacts roles',
  },
  {
    path: 'approvedBy',
    select: 'name contacts',
  },
  {
    path: 'parentBooking',
    select: 'title recurrenceType startDateTime endDateTime',
  },
];

const ADVANCE_BOOKING_LIMIT_DAYS = 90; // Maximum days in advance for booking
const MIN_ADVANCE_NOTICE_HOURS = 2; // Minimum hours advance notice required
const MAX_BOOKING_DURATION_HOURS = 24; // Maximum booking duration in hours

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private roomsService: RoomsService,
    private schedulesService: SchedulesService,
    private usersService: UsersService,
  ) {}

  async create(
    createBookingDto: CreateBookingDto,
    currentUser: UserDocument,
  ): Promise<BookingDocument> {
    try {
      // Validate referenced entities
      const [room, bookedByUser] = await Promise.all([
        this.roomsService.findOne(createBookingDto.room),
        this.usersService.getById(createBookingDto.bookedBy),
      ]);

      if (!room) {
        throw new BadRequestException('Room not found');
      }

      if (!bookedByUser) {
        throw new BadRequestException('User not found');
      }

      // Validate booking constraints
      await this.validateBookingConstraints(
        createBookingDto.room,
        new Date(createBookingDto.startDateTime),
        new Date(createBookingDto.endDateTime),
        createBookingDto.metadata?.estimatedAttendees || 1,
        createBookingDto.bookedBy,
      );

      // Handle recurring bookings
      if (
        createBookingDto.recurrenceType &&
        createBookingDto.recurrenceType !== RecurrenceType.NONE
      ) {
        return await this.createRecurringSeries(createBookingDto, currentUser);
      }

      // Create single booking
      const booking = new this.bookingModel({
        ...createBookingDto,
        status: BookingStatus.PENDING,
        startDateTime: new Date(createBookingDto.startDateTime),
        endDateTime: new Date(createBookingDto.endDateTime),
      });

      const savedBooking = await booking.save();
      return this.findOne(savedBooking._id.toString());
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new Error(`Failed to create booking: ${error.message}`);
    }
  }

  async createRecurringSeries(
    bookingData: CreateBookingDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentUser: UserDocument,
  ): Promise<BookingDocument> {
    const recurrenceOptions: RecurrenceOptions = {
      type: bookingData.recurrenceType,
      interval: bookingData.recurrenceInterval || 1,
      daysOfWeek: bookingData.daysOfWeek,
      endDate: bookingData.recurrenceEndDate
        ? new Date(bookingData.recurrenceEndDate)
        : undefined,
      maxOccurrences: 100, // Safety limit
    };

    // Validate recurrence options
    if (!RecurrenceCalculator.isValidRecurrenceOptions(recurrenceOptions)) {
      throw new BadRequestException('Invalid recurrence options');
    }

    // Generate recurrence instances
    const instances = RecurrenceCalculator.generateRecurrenceInstances(
      new Date(bookingData.startDateTime),
      new Date(bookingData.endDateTime),
      recurrenceOptions,
    );

    if (instances.length === 0) {
      throw new BadRequestException('No recurring instances generated');
    }

    // Create parent booking
    const parentBooking = new this.bookingModel({
      ...bookingData,
      status: BookingStatus.PENDING,
      startDateTime: instances[0].startDateTime,
      endDateTime: instances[0].endDateTime,
      childBookings: [],
    });

    const savedParent = await parentBooking.save();

    // Create child bookings for subsequent instances
    const childBookings = [];
    for (let i = 1; i < instances.length; i++) {
      const instance = instances[i];

      // Validate availability for each instance
      await this.validateAvailability(
        bookingData.room,
        instance.startDateTime,
        instance.endDateTime,
        savedParent._id.toString(),
      );

      const childBooking = new this.bookingModel({
        ...bookingData,
        startDateTime: instance.startDateTime,
        endDateTime: instance.endDateTime,
        parentBooking: savedParent._id,
        status: BookingStatus.PENDING,
      });

      const savedChild = await childBooking.save();
      childBookings.push(savedChild._id);
    }

    // Update parent with child references
    savedParent.childBookings = childBookings;
    await savedParent.save();

    return this.findOne(savedParent._id.toString());
  }

  async findAll(
    queryParams: BookingQueryParams = {},
  ): Promise<BookingDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const query: FilterQuery<BookingDocument> = {};

    if (safeParams.room && typeof safeParams.room === 'string') {
      const validRoomId = validateObjectId(safeParams.room);
      if (validRoomId) {
        query.room = validRoomId;
      }
    }

    if (safeParams.bookedBy && typeof safeParams.bookedBy === 'string') {
      const validUserId = validateObjectId(safeParams.bookedBy);
      if (validUserId) {
        query.bookedBy = validUserId;
      }
    }

    if (safeParams.status) {
      query.status = safeParams.status;
    }

    // Date range filtering
    if (safeParams.startDate || safeParams.endDate) {
      const { from, to } = sanitizeDateRange(
        safeParams.startDate as string,
        safeParams.endDate as string,
      );
      const dateQuery: FilterQuery<BookingDocument> = {};

      if (from) {
        dateQuery.$gte = new Date(from);
      }
      if (to) {
        dateQuery.$lte = new Date(to);
      }

      if (Object.keys(dateQuery).length > 0) {
        query.startDateTime = dateQuery;
      }
    }

    // Filter out child bookings unless specifically requested
    if (safeParams.includeChildBookings !== 'true') {
      query.parentBooking = { $exists: false };
    }

    const sort: { [key: string]: 1 | -1 } = { startDateTime: 1 };
    if (safeParams.sortBy === 'created') {
      sort.createdAt = safeParams.sortOrder === 'desc' ? -1 : 1;
    }

    return this.bookingModel
      .find(query)
      .populate(submodels)
      .sort(sort)
      .limit(safeParams.limit ? parseInt(safeParams.limit as string) : 100)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<BookingDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid booking ID format');
    }

    const booking = await this.bookingModel
      .findById(validId)
      .populate(submodels)
      .populate({
        path: 'childBookings',
        select: 'title startDateTime endDateTime status',
      })
      .lean()
      .exec();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking as BookingDocument;
  }

  async findByUser(
    userId: string,
    queryParams: BookingQueryParams = {},
  ): Promise<BookingDocument[]> {
    const validUserId = validateObjectId(userId);
    if (!validUserId) {
      throw new BadRequestException('Invalid user ID format');
    }

    const user = await this.usersService.getById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const safeParams = safeFindParams(queryParams);
    const query: FilterQuery<BookingDocument> = { bookedBy: validUserId };

    if (safeParams.status) {
      query.status = safeParams.status;
    }

    if (safeParams.upcoming === 'true') {
      query.startDateTime = { $gte: new Date() };
    }

    return this.bookingModel
      .find(query)
      .populate(submodels)
      .sort({ startDateTime: 1 })
      .lean()
      .exec();
  }

  async findByRoom(
    roomId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<BookingDocument[]> {
    const validRoomId = validateObjectId(roomId);
    if (!validRoomId) {
      throw new BadRequestException('Invalid room ID format');
    }

    const room = await this.roomsService.findOne(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const query: FilterQuery<BookingDocument> = {
      room: validRoomId,
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
    };

    if (startDate || endDate) {
      const { from, to } = sanitizeDateRange(
        startDate?.toISOString(),
        endDate?.toISOString(),
      );

      query.$or = [
        // Bookings that start within the date range
        {
          startDateTime: {
            $gte: from ? new Date(from) : new Date('1970-01-01'),
            $lte: to ? new Date(to) : new Date('2099-12-31'),
          },
        },
        // Bookings that end within the date range
        {
          endDateTime: {
            $gte: from ? new Date(from) : new Date('1970-01-01'),
            $lte: to ? new Date(to) : new Date('2099-12-31'),
          },
        },
        // Bookings that span the entire date range
        {
          startDateTime: {
            $lte: from ? new Date(from) : new Date('1970-01-01'),
          },
          endDateTime: { $gte: to ? new Date(to) : new Date('2099-12-31') },
        },
      ];
    }

    return this.bookingModel
      .find(query)
      .populate('bookedBy', 'name contacts')
      .sort({ startDateTime: 1 })
      .lean()
      .exec();
  }

  async findPendingApprovals(
    queryParams: BookingQueryParams = {},
  ): Promise<BookingDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const query: FilterQuery<BookingDocument> = {
      status: BookingStatus.PENDING,
    };

    if (safeParams.room && typeof safeParams.room === 'string') {
      const validRoomId = validateObjectId(safeParams.room);
      if (validRoomId) {
        query.room = validRoomId;
      }
    }

    return this.bookingModel
      .find(query)
      .populate(submodels)
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    updateBookingDto: UpdateBookingDto,
  ): Promise<BookingDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid booking ID format');
    }

    const existingBooking = await this.findOne(id);
    if (!existingBooking) {
      throw new NotFoundException('Booking not found');
    }

    // Prevent updates to cancelled bookings
    if (existingBooking.status === BookingStatus.CANCELED) {
      throw new ForbiddenException('Cannot modify cancelled bookings');
    }

    // If updating time or room, validate availability
    if (
      updateBookingDto.startDateTime ||
      updateBookingDto.endDateTime ||
      updateBookingDto.room
    ) {
      const startDateTime = updateBookingDto.startDateTime
        ? new Date(updateBookingDto.startDateTime)
        : existingBooking.startDateTime;
      const endDateTime = updateBookingDto.endDateTime
        ? new Date(updateBookingDto.endDateTime)
        : existingBooking.endDateTime;
      const roomId =
        updateBookingDto.room || existingBooking.room._id.toString();

      await this.validateAvailability(roomId, startDateTime, endDateTime, id);
    }

    await this.bookingModel
      .findByIdAndUpdate(validId, updateBookingDto, { new: true })
      .lean()
      .exec();

    return this.findOne(validId);
  }

  async remove(id: string): Promise<void> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid booking ID format');
    }

    const booking = await this.findOne(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // If it's a parent booking with children, remove all children
    if (booking.childBookings && booking.childBookings.length > 0) {
      await this.bookingModel.deleteMany({
        parentBooking: validId,
      });
    }

    // If it's a child booking, remove reference from parent
    if (booking.parentBooking) {
      await this.bookingModel.findByIdAndUpdate(booking.parentBooking._id, {
        $pull: { childBookings: validId },
      });
    }

    const result = await this.bookingModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Booking not found');
    }
  }

  async approveBooking(
    id: string,
    adminUserId: string,
  ): Promise<BookingDocument> {
    const validId = validateObjectId(id);
    const validAdminId = validateObjectId(adminUserId);

    if (!validId || !validAdminId) {
      throw new BadRequestException('Invalid ID format');
    }

    const booking = await this.findOne(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Only pending bookings can be approved');
    }

    const admin = await this.usersService.getById(adminUserId);
    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    // Validate availability one more time before approval
    await this.validateAvailability(
      booking.room._id.toString(),
      booking.startDateTime,
      booking.endDateTime,
      id,
    );

    await this.bookingModel
      .findByIdAndUpdate(
        validId,
        {
          status: BookingStatus.CONFIRMED,
          approvedBy: validAdminId,
          approvedAt: new Date(),
        },
        { new: true },
      )
      .lean()
      .exec();

    return this.findOne(validId);
  }

  async cancelBooking(
    id: string,
    reason: string,
    userId?: string,
  ): Promise<BookingDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid booking ID format');
    }

    const booking = await this.findOne(id);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.CANCELED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    // Check if user has permission to cancel (booking owner or admin)
    if (userId) {
      const validUserId = validateObjectId(userId);
      if (validUserId && booking.bookedBy._id.toString() !== validUserId) {
        throw new ForbiddenException('You can only cancel your own bookings');
      }
    }

    await this.bookingModel
      .findByIdAndUpdate(
        validId,
        {
          status: BookingStatus.CANCELED,
          cancellationReason: reason,
          canceledAt: new Date(),
        },
        { new: true },
      )
      .lean()
      .exec();

    return this.findOne(validId);
  }

  async exportBookings(
    filter: BookingQueryParams = {},
  ): Promise<Record<string, unknown>[]> {
    const bookings = await this.findAll(filter);

    return bookings.map((booking) => ({
      id: booking._id,
      title: booking.title,
      description: booking.description,
      roomName: booking.room?.name,
      roomCapacity: booking.room?.capacity,
      companyName: booking.room?.company?.name,
      bookedByName: booking.bookedBy?.name,
      startDateTime: booking.startDateTime,
      endDateTime: booking.endDateTime,
      status: booking.status,
      recurrenceType: booking.recurrenceType,
      attendeesCount: booking.attendees?.length || 0,
      estimatedAttendees: booking.metadata?.estimatedAttendees,
      purpose: booking.metadata?.purpose,
      department: booking.metadata?.department,
      contactEmail: booking.metadata?.contactEmail,
      isPrivate: booking.metadata?.isPrivate,
      equipmentRequests: booking.equipmentRequests,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      approvedBy: booking.approvedBy?.name,
      approvedAt: booking.approvedAt,
      cancellationReason: booking.cancellationReason,
      canceledAt: booking.canceledAt,
    }));
  }

  async validateAvailability(
    roomId: string,
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    const validRoomId = validateObjectId(roomId);
    if (!validRoomId) {
      throw new BadRequestException('Invalid room ID format');
    }

    // Check for overlapping bookings
    const query: FilterQuery<BookingDocument> = {
      room: validRoomId,
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      $or: [
        // Booking starts during existing booking
        {
          startDateTime: { $lt: endDateTime },
          endDateTime: { $gt: startDateTime },
        },
      ],
    };

    // Exclude current booking if updating
    if (excludeBookingId) {
      const validExcludeId = validateObjectId(excludeBookingId);
      if (validExcludeId) {
        query._id = { $ne: validExcludeId };
      }
    }

    const conflictingBookings = await this.bookingModel.find(query).exec();

    if (conflictingBookings.length > 0) {
      throw new ConflictException(
        `Room is not available during the requested time. ${conflictingBookings.length} conflicting booking(s) found.`,
      );
    }

    // Check room schedule availability
    const isAvailable = await this.schedulesService.isTimeSlotAvailable(
      roomId,
      startDateTime,
      startDateTime.toTimeString().substring(0, 5), // HH:MM format
      endDateTime.toTimeString().substring(0, 5), // HH:MM format
    );

    if (!isAvailable) {
      throw new ConflictException(
        'Room is not available during the requested time according to schedule',
      );
    }
  }

  private async validateBookingConstraints(
    roomId: string,
    startDateTime: Date,
    endDateTime: Date,
    estimatedAttendees: number,
    userId?: string,
  ): Promise<void> {
    const now = new Date();

    // Check advance notice
    const hoursInAdvance =
      (startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursInAdvance < MIN_ADVANCE_NOTICE_HOURS) {
      throw new BadRequestException(
        `Booking must be made at least ${MIN_ADVANCE_NOTICE_HOURS} hours in advance`,
      );
    }

    // Check advance booking limit
    const daysInAdvance = hoursInAdvance / 24;
    if (daysInAdvance > ADVANCE_BOOKING_LIMIT_DAYS) {
      throw new BadRequestException(
        `Bookings cannot be made more than ${ADVANCE_BOOKING_LIMIT_DAYS} days in advance`,
      );
    }

    // Check booking duration
    const durationHours =
      (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    if (durationHours > MAX_BOOKING_DURATION_HOURS) {
      throw new BadRequestException(
        `Booking duration cannot exceed ${MAX_BOOKING_DURATION_HOURS} hours`,
      );
    }

    // Check room capacity and role-based access control
    const room = await this.roomsService.findOne(roomId);
    if (room && estimatedAttendees > room.capacity) {
      throw new BadRequestException(
        `Estimated attendees (${estimatedAttendees}) exceeds room capacity (${room.capacity})`,
      );
    }

    // Role-based access control validation
    if (room && room.allowedRoles && room.allowedRoles.length > 0 && userId) {
      const user = await this.usersService.getById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Admin users can bypass role restrictions
      if (user.roles.includes(Role.Admin)) {
        // Allow admin to proceed regardless of room restrictions
        return;
      }

      // Check if user has any of the required roles
      const hasRequiredRole = user.roles.some((userRole) =>
        room.allowedRoles.includes(userRole),
      );

      if (!hasRequiredRole) {
        throw new ForbiddenException(
          `Access denied. This room requires one of the following roles: ${room.allowedRoles.join(
            ', ',
          )}`,
        );
      }
    }

    // Check if booking is in the past
    if (startDateTime <= now) {
      throw new BadRequestException('Cannot create bookings in the past');
    }

    // Validate availability
    await this.validateAvailability(roomId, startDateTime, endDateTime);
  }

  async getBookingStats(
    queryParams: BookingQueryParams = {},
  ): Promise<Record<string, unknown>> {
    const safeParams = safeFindParams(queryParams);
    const matchQuery: Record<string, string | Record<string, unknown>> = {};

    if (safeParams.room && typeof safeParams.room === 'string') {
      const validRoomId = validateObjectId(safeParams.room);
      if (validRoomId) {
        matchQuery.room = validRoomId;
      }
    }

    if (safeParams.startDate || safeParams.endDate) {
      const { from, to } = sanitizeDateRange(
        safeParams.startDate as string,
        safeParams.endDate as string,
      );
      if (from || to) {
        matchQuery.startDateTime = {};
        if (from) matchQuery.startDateTime.$gte = new Date(from);
        if (to) matchQuery.startDateTime.$lte = new Date(to);
      }
    }

    const stats = await this.bookingModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDuration: {
            $sum: {
              $divide: [
                { $subtract: ['$endDateTime', '$startDateTime'] },
                1000 * 60 * 60, // Convert to hours
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: '$count' },
          statusBreakdown: {
            $push: {
              status: '$_id',
              count: '$count',
              totalHours: { $round: ['$totalDuration', 2] },
            },
          },
          totalHours: { $sum: '$totalDuration' },
        },
      },
    ]);

    return stats.length > 0
      ? stats[0]
      : {
          totalBookings: 0,
          statusBreakdown: [],
          totalHours: 0,
        };
  }

  async getUpcomingBookings(
    userId?: string,
    limit = 10,
  ): Promise<BookingDocument[]> {
    const query: FilterQuery<BookingDocument> = {
      startDateTime: { $gte: new Date() },
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
    };

    if (userId) {
      const validUserId = validateObjectId(userId);
      if (validUserId) {
        query.bookedBy = validUserId;
      }
    }

    return this.bookingModel
      .find(query)
      .populate(submodels)
      .sort({ startDateTime: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async getBookingConflicts(
    roomId: string,
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string,
  ): Promise<BookingDocument[]> {
    const validRoomId = validateObjectId(roomId);
    if (!validRoomId) {
      throw new BadRequestException('Invalid room ID format');
    }

    const query: FilterQuery<BookingDocument> = {
      room: validRoomId,
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      $or: [
        // Booking starts during the requested time
        {
          startDateTime: { $lt: endDateTime },
          endDateTime: { $gt: startDateTime },
        },
      ],
    };

    if (excludeBookingId) {
      const validExcludeId = validateObjectId(excludeBookingId);
      if (validExcludeId) {
        query._id = { $ne: validExcludeId };
      }
    }

    return this.bookingModel
      .find(query)
      .populate('bookedBy', 'name contacts')
      .sort({ startDateTime: 1 })
      .lean()
      .exec();
  }

  async bulkApproveBookings(
    bookingIds: string[],
    adminUserId: string,
  ): Promise<BookingDocument[]> {
    const validAdminId = validateObjectId(adminUserId);
    if (!validAdminId) {
      throw new BadRequestException('Invalid admin user ID format');
    }

    const admin = await this.usersService.getById(adminUserId);
    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    const validBookingIds = bookingIds
      .map((id) => validateObjectId(id))
      .filter((id) => id !== null);

    if (validBookingIds.length === 0) {
      throw new BadRequestException('No valid booking IDs provided');
    }

    // Update all bookings in bulk
    await this.bookingModel.updateMany(
      {
        _id: { $in: validBookingIds },
        status: BookingStatus.PENDING,
      },
      {
        $set: {
          status: BookingStatus.CONFIRMED,
          approvedBy: validAdminId,
          approvedAt: new Date(),
        },
      },
    );

    // Return updated bookings
    const approvedBookings = await this.bookingModel
      .find({ _id: { $in: validBookingIds } })
      .populate(submodels)
      .lean()
      .exec();

    return approvedBookings;
  }

  async getRecurringBookingSeries(
    parentBookingId: string,
  ): Promise<BookingDocument[]> {
    const validParentId = validateObjectId(parentBookingId);
    if (!validParentId) {
      throw new BadRequestException('Invalid parent booking ID format');
    }

    const parentBooking = await this.findOne(parentBookingId);
    if (!parentBooking) {
      throw new NotFoundException('Parent booking not found');
    }

    // Get all bookings in the series (parent + children)
    const seriesBookings = await this.bookingModel
      .find({
        $or: [{ _id: validParentId }, { parentBooking: validParentId }],
      })
      .populate(submodels)
      .sort({ startDateTime: 1 })
      .lean()
      .exec();

    return seriesBookings;
  }

  async cancelRecurringSeries(
    parentBookingId: string,
    reason: string,
    userId?: string,
  ): Promise<void> {
    const validParentId = validateObjectId(parentBookingId);
    if (!validParentId) {
      throw new BadRequestException('Invalid parent booking ID format');
    }

    const parentBooking = await this.findOne(parentBookingId);
    if (!parentBooking) {
      throw new NotFoundException('Parent booking not found');
    }

    // Check permissions
    if (userId) {
      const validUserId = validateObjectId(userId);
      if (
        validUserId &&
        parentBooking.bookedBy._id.toString() !== validUserId
      ) {
        throw new ForbiddenException(
          'You can only cancel your own booking series',
        );
      }
    }

    // Cancel all bookings in the series
    await this.bookingModel.updateMany(
      {
        $or: [{ _id: validParentId }, { parentBooking: validParentId }],
        status: { $ne: BookingStatus.CANCELED },
      },
      {
        $set: {
          status: BookingStatus.CANCELED,
          cancellationReason: reason,
          canceledAt: new Date(),
        },
      },
    );
  }
}
