import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../users/users.service';
import { RoomsService } from '../rooms/rooms.service';
import { SchedulesService } from '../schedules/schedules.service';
import { BookingsService } from './bookings.service';
import { BookingStatus } from './enums/booking-status.enum';
import { RecurrenceType } from './enums/recurrence-type.enum';
import { Booking } from './schemas/booking.schema';

describe('BookingsService', () => {
  let service: BookingsService;

  const mockUser = {
    _id: '507f1f77bcf86cd799439014',
    name: 'John Doe',
    roles: ['user'],
    contacts: [
      {
        type: 'email',
        value: 'john@example.com',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCompany = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Company',
    address: '123 Test Street',
    isActive: true,
  };

  const mockRoom = {
    _id: '507f1f77bcf86cd799439012',
    name: 'Conference Room A',
    capacity: 12,
    company: mockCompany,
    location: '2nd Floor',
    amenities: ['WiFi', 'Projector'],
    isActive: true,
    settings: {
      allowMultipleBookings: false,
      minimumBookingDuration: 30,
      maximumBookingDuration: 480,
    },
    equipment: {
      projector: true,
      whiteboard: true,
      wifi: true,
    },
  };

  const mockBooking = {
    _id: '507f1f77bcf86cd799439015',
    title: 'Team Meeting',
    description: 'Weekly team sync',
    room: mockRoom,
    bookedBy: mockUser,
    startDateTime: new Date('2024-02-15T10:00:00.000Z'),
    endDateTime: new Date('2024-02-15T11:00:00.000Z'),
    status: BookingStatus.PENDING,
    recurrenceType: RecurrenceType.NONE,
    parentBooking: undefined,
    childBookings: [],
    recurrenceEndDate: undefined,
    daysOfWeek: [],
    recurrenceInterval: 1,
    attendees: ['john@example.com'],
    timeZone: 'UTC',
    metadata: {
      purpose: 'Team sync',
      department: 'Engineering',
      contactEmail: 'john@example.com',
      estimatedAttendees: 5,
      isPrivate: false,
    },
    equipmentRequests: {
      projector: true,
      microphone: false,
      videoConferencing: false,
      catering: false,
      whiteboard: true,
      flipChart: false,
      other: [],
    },
    approvedBy: undefined,
    approvedAt: undefined,
    cancellationReason: undefined,
    canceledAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create mock instance methods
  const mockSave = jest.fn().mockResolvedValue(mockBooking);
  const mockInstance = {
    save: mockSave,
  };

  // Create mock model with both constructor and static methods
  const mockBookingModel = Object.assign(
    jest.fn().mockImplementation(() => mockInstance),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      exec: jest.fn(),
      lean: jest.fn(),
      sort: jest.fn(),
      populate: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
      limit: jest.fn(),
    },
  );

  const mockRoomsService = {
    findOne: jest.fn(),
  };

  const mockSchedulesService = {
    isTimeSlotAvailable: jest.fn(),
  };

  const mockUsersService = {
    getById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getModelToken(Booking.name),
          useValue: mockBookingModel,
        },
        {
          provide: RoomsService,
          useValue: mockRoomsService,
        },
        {
          provide: SchedulesService,
          useValue: mockSchedulesService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new booking when room is available', async () => {
      const createBookingDto = {
        title: 'New Meeting',
        room: '507f1f77bcf86cd799439012',
        bookedBy: '507f1f77bcf86cd799439014',
        startDateTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        endDateTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        recurrenceType: RecurrenceType.NONE,
        description: 'Team meeting description',
      };

      mockRoomsService.findOne.mockResolvedValue(mockRoom);
      mockUsersService.getById.mockResolvedValue(mockUser);
      mockSchedulesService.isTimeSlotAvailable.mockResolvedValue(true);

      // Mock no conflicting bookings
      mockBookingModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      // Mock findOne for the returned booking
      const mockFindChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBooking),
      };

      mockBookingModel.findById.mockReturnValue(mockFindChain);

      const result = await service.create(createBookingDto);

      expect(result).toEqual(mockBooking);
      expect(mockSave).toHaveBeenCalled();
      expect(mockRoomsService.findOne).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
      );
      expect(mockUsersService.getById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439014',
      );
      expect(mockSchedulesService.isTimeSlotAvailable).toHaveBeenCalled();
    });

    it('should throw BadRequestException if room not found', async () => {
      const createBookingDto = {
        title: 'New Meeting',
        room: '507f1f77bcf86cd799439012',
        bookedBy: '507f1f77bcf86cd799439014',
        startDateTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        endDateTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        recurrenceType: RecurrenceType.NONE,
      };

      mockRoomsService.findOne.mockResolvedValue(null);

      await expect(service.create(createBookingDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user not found', async () => {
      const createBookingDto = {
        title: 'New Meeting',
        room: '507f1f77bcf86cd799439012',
        bookedBy: '507f1f77bcf86cd799439014',
        startDateTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        endDateTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        recurrenceType: RecurrenceType.NONE,
      };

      mockRoomsService.findOne.mockResolvedValue(mockRoom);
      mockUsersService.getById.mockResolvedValue(null);

      await expect(service.create(createBookingDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if room is not available in schedule', async () => {
      const createBookingDto = {
        title: 'New Meeting',
        room: '507f1f77bcf86cd799439012',
        bookedBy: '507f1f77bcf86cd799439014',
        startDateTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        endDateTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        recurrenceType: RecurrenceType.NONE,
      };

      mockRoomsService.findOne.mockResolvedValue(mockRoom);
      mockUsersService.getById.mockResolvedValue(mockUser);
      mockSchedulesService.isTimeSlotAvailable.mockResolvedValue(false);

      await expect(service.create(createBookingDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if there are conflicting bookings', async () => {
      const createBookingDto = {
        title: 'New Meeting',
        room: '507f1f77bcf86cd799439012',
        bookedBy: '507f1f77bcf86cd799439014',
        startDateTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        endDateTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        recurrenceType: RecurrenceType.NONE,
      };

      mockRoomsService.findOne.mockResolvedValue(mockRoom);
      mockUsersService.getById.mockResolvedValue(mockUser);
      mockSchedulesService.isTimeSlotAvailable.mockResolvedValue(true);

      // Mock conflicting booking
      mockBookingModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockBooking]),
      });

      await expect(service.create(createBookingDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of bookings', async () => {
      const bookings = [mockBooking];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookings),
      };

      mockBookingModel.find.mockReturnValue(mockChain);

      const result = await service.findAll();

      expect(result).toEqual(bookings);
      expect(mockBookingModel.find).toHaveBeenCalled();
    });

    it('should filter bookings by room', async () => {
      const queryParams = { room: '507f1f77bcf86cd799439012' };
      const bookings = [mockBooking];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookings),
      };

      mockBookingModel.find.mockReturnValue(mockChain);

      const result = await service.findAll(queryParams);

      expect(result).toEqual(bookings);
      expect(mockBookingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          room: '507f1f77bcf86cd799439012',
        }),
      );
    });

    it('should filter bookings by status', async () => {
      const queryParams = { status: BookingStatus.CONFIRMED };
      const bookings = [mockBooking];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookings),
      };

      mockBookingModel.find.mockReturnValue(mockChain);

      const result = await service.findAll(queryParams);

      expect(result).toEqual(bookings);
      expect(mockBookingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BookingStatus.CONFIRMED,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a booking by id', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBooking),
      };

      mockBookingModel.findById.mockReturnValue(mockChain);

      const result = await service.findOne('507f1f77bcf86cd799439015');

      expect(result).toEqual(mockBooking);
      expect(mockBookingModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439015',
      );
    });

    it('should throw NotFoundException if booking not found', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockBookingModel.findById.mockReturnValue(mockChain);

      await expect(service.findOne('507f1f77bcf86cd799439015')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for invalid id format', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUser', () => {
    it('should return bookings for a specific user', async () => {
      const userId = '507f1f77bcf86cd799439014';
      const bookings = [mockBooking];

      mockUsersService.getById.mockResolvedValue(mockUser);

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookings),
      };

      mockBookingModel.find.mockReturnValue(mockChain);

      const result = await service.findByUser(userId);

      expect(result).toEqual(bookings);
      expect(mockUsersService.getById).toHaveBeenCalledWith(userId);
      expect(mockBookingModel.find).toHaveBeenCalledWith({ bookedBy: userId });
    });

    it('should throw NotFoundException if user not found', async () => {
      const userId = '507f1f77bcf86cd799439014';

      mockUsersService.getById.mockResolvedValue(null);

      await expect(service.findByUser(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid user id format', async () => {
      await expect(service.findByUser('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByRoom', () => {
    it('should return bookings for a specific room', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const bookings = [mockBooking];

      mockRoomsService.findOne.mockResolvedValue(mockRoom);

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(bookings),
      };

      mockBookingModel.find.mockReturnValue(mockChain);

      const result = await service.findByRoom(roomId);

      expect(result).toEqual(bookings);
      expect(mockRoomsService.findOne).toHaveBeenCalledWith(roomId);
    });

    it('should throw NotFoundException if room not found', async () => {
      const roomId = '507f1f77bcf86cd799439012';

      mockRoomsService.findOne.mockResolvedValue(null);

      await expect(service.findByRoom(roomId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid room id format', async () => {
      await expect(service.findByRoom('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approveBooking', () => {
    it('should approve a pending booking', async () => {
      const adminUserId = '507f1f77bcf86cd799439016';
      const pendingBooking = {
        ...mockBooking,
        status: BookingStatus.PENDING,
      };
      const approvedBooking = {
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
        approvedBy: adminUserId,
        approvedAt: new Date(),
      };

      // Mock findOne to return the pending booking
      const mockFindChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(pendingBooking),
      };

      mockBookingModel.findById.mockReturnValue(mockFindChain);

      mockUsersService.getById.mockResolvedValue(mockUser);
      mockSchedulesService.isTimeSlotAvailable.mockResolvedValue(true);
      mockBookingModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      // Mock update operation
      const mockUpdateChain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(approvedBooking),
      };

      mockBookingModel.findByIdAndUpdate.mockReturnValue(mockUpdateChain);

      const result = await service.approveBooking(
        '507f1f77bcf86cd799439015',
        adminUserId,
      );

      expect(result).toEqual(pendingBooking); // Returns result of findOne
      expect(mockBookingModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439015',
        expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          approvedBy: adminUserId,
          approvedAt: expect.any(Date),
        }),
        { new: true },
      );
    });

    it('should throw NotFoundException if booking not found', async () => {
      const adminUserId = '507f1f77bcf86cd799439016';

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockBookingModel.findById.mockReturnValue(mockChain);

      await expect(
        service.approveBooking('507f1f77bcf86cd799439015', adminUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid booking id format', async () => {
      const adminUserId = '507f1f77bcf86cd799439016';

      await expect(
        service.approveBooking('invalid-id', adminUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking with reason', async () => {
      const reason = 'Meeting canceled';
      const activeBooking = {
        ...mockBooking,
        status: BookingStatus.PENDING,
        bookedBy: { ...mockUser, _id: '507f1f77bcf86cd799439014' },
      };
      const canceledBooking = {
        ...mockBooking,
        status: BookingStatus.CANCELED,
        cancellationReason: reason,
        canceledAt: new Date(),
      };

      // Mock findOne to return the active booking
      const mockFindChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(activeBooking),
      };

      mockBookingModel.findById.mockReturnValue(mockFindChain);

      // Mock update operation
      const mockUpdateChain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(canceledBooking),
      };

      mockBookingModel.findByIdAndUpdate.mockReturnValue(mockUpdateChain);

      const result = await service.cancelBooking(
        '507f1f77bcf86cd799439015',
        reason,
      );

      expect(result).toEqual(activeBooking); // Returns result of findOne
      expect(mockBookingModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439015',
        expect.objectContaining({
          status: BookingStatus.CANCELED,
          cancellationReason: reason,
          canceledAt: expect.any(Date),
        }),
        { new: true },
      );
    });

    it('should throw NotFoundException if booking not found', async () => {
      const reason = 'Meeting canceled';

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockBookingModel.findById.mockReturnValue(mockChain);

      await expect(
        service.cancelBooking('507f1f77bcf86cd799439015', reason),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if booking is already canceled', async () => {
      const reason = 'Meeting canceled';
      const canceledBooking = {
        ...mockBooking,
        status: BookingStatus.CANCELED,
      };

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(canceledBooking),
      };

      mockBookingModel.findById.mockReturnValue(mockChain);

      await expect(
        service.cancelBooking('507f1f77bcf86cd799439015', reason),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateAvailability', () => {
    it('should not throw if room is available', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const startDateTime = new Date('2024-02-20T10:00:00.000Z');
      const endDateTime = new Date('2024-02-20T11:00:00.000Z');

      mockSchedulesService.isTimeSlotAvailable.mockResolvedValue(true);
      mockBookingModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.validateAvailability(roomId, startDateTime, endDateTime),
      ).resolves.not.toThrow();

      expect(mockSchedulesService.isTimeSlotAvailable).toHaveBeenCalled();
    });

    it('should throw ConflictException if room is not available in schedule', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const startDateTime = new Date('2024-02-20T10:00:00.000Z');
      const endDateTime = new Date('2024-02-20T11:00:00.000Z');

      mockSchedulesService.isTimeSlotAvailable.mockResolvedValue(false);

      await expect(
        service.validateAvailability(roomId, startDateTime, endDateTime),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if there are conflicting bookings', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const startDateTime = new Date('2024-02-20T10:00:00.000Z');
      const endDateTime = new Date('2024-02-20T11:00:00.000Z');

      mockSchedulesService.isTimeSlotAvailable.mockResolvedValue(true);
      mockBookingModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockBooking]),
      });

      await expect(
        service.validateAvailability(roomId, startDateTime, endDateTime),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findPendingApprovals', () => {
    it('should return pending bookings', async () => {
      const pendingBookings = [
        { ...mockBooking, status: BookingStatus.PENDING },
      ];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(pendingBookings),
      };

      mockBookingModel.find.mockReturnValue(mockChain);

      const result = await service.findPendingApprovals();

      expect(result).toEqual(pendingBookings);
      expect(mockBookingModel.find).toHaveBeenCalledWith({
        status: BookingStatus.PENDING,
      });
    });
  });

  describe('remove', () => {
    it('should remove a booking', async () => {
      const simpleBooking = {
        ...mockBooking,
        childBookings: [],
        parentBooking: undefined,
      };

      // Mock findOne to return the booking
      const mockFindChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(simpleBooking),
      };

      mockBookingModel.findById.mockReturnValue(mockFindChain);

      mockBookingModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBooking),
      });

      await service.remove('507f1f77bcf86cd799439015');

      expect(mockBookingModel.findByIdAndDelete).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439015',
      );
    });

    it('should throw NotFoundException if booking not found', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockBookingModel.findById.mockReturnValue(mockChain);

      await expect(service.remove('507f1f77bcf86cd799439015')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for invalid id format', async () => {
      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUpcomingBookings', () => {
    it('should return upcoming bookings', async () => {
      const upcomingBookings = [mockBooking];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(upcomingBookings),
      };

      mockBookingModel.find.mockReturnValue(mockChain);

      const result = await service.getUpcomingBookings();

      expect(result).toEqual(upcomingBookings);
      expect(mockBookingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          startDateTime: expect.objectContaining({ $gte: expect.any(Date) }),
          status: expect.objectContaining({
            $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          }),
        }),
      );
    });

    it('should filter by user if provided', async () => {
      const userId = '507f1f77bcf86cd799439014';
      const upcomingBookings = [mockBooking];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(upcomingBookings),
      };

      mockBookingModel.find.mockReturnValue(mockChain);

      const result = await service.getUpcomingBookings(userId);

      expect(result).toEqual(upcomingBookings);
      expect(mockBookingModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          bookedBy: userId,
          startDateTime: expect.objectContaining({ $gte: expect.any(Date) }),
          status: expect.objectContaining({
            $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          }),
        }),
      );
    });
  });
});
