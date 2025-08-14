import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from '../companies/companies.service';
import { RoomsService } from '../rooms/rooms.service';
import { SchedulesService } from './schedules.service';
import {
  RecurrencePattern,
  Schedule,
  ScheduleType,
} from './schemas/schedule.schema';

describe('SchedulesService', () => {
  let service: SchedulesService;

  const mockRoom = {
    _id: '507f1f77bcf86cd799439012',
    name: 'Conference Room A',
    capacity: 12,
    company: '507f1f77bcf86cd799439011',
    isActive: true,
  };

  const mockCompany = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Company',
    address: '123 Test Street',
    isActive: true,
  };

  const mockSchedule = {
    _id: '507f1f77bcf86cd799439013',
    name: 'Working Hours',
    description: 'Standard business hours',
    type: ScheduleType.WORKING_HOURS,
    room: mockRoom,
    company: mockCompany,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    startTime: '09:00',
    endTime: '17:00',
    recurrencePattern: RecurrencePattern.WEEKLY,
    daysOfWeek: [1, 2, 3, 4, 5],
    recurrenceEndDate: new Date('2024-12-31'),
    isActive: true,
    timeZone: 'UTC',
    metadata: {
      reason: 'Business hours',
      contactPerson: 'Admin',
      priority: 1,
      color: '#0066cc',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create mock instance methods
  const mockSave = jest.fn().mockResolvedValue(mockSchedule);
  const mockInstance = {
    save: mockSave,
  };

  // Create mock model with both constructor and static methods
  const mockScheduleModel = Object.assign(
    jest.fn().mockImplementation(() => mockInstance),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      create: jest.fn(),
      exec: jest.fn(),
      save: jest.fn(),
      lean: jest.fn(),
      sort: jest.fn(),
      populate: jest.fn(),
    },
  );

  const mockRoomsService = {
    findOne: jest.fn(),
    findByCompany: jest.fn(),
  };

  const mockCompaniesService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: getModelToken(Schedule.name),
          useValue: mockScheduleModel,
        },
        {
          provide: RoomsService,
          useValue: mockRoomsService,
        },
        {
          provide: CompaniesService,
          useValue: mockCompaniesService,
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new schedule', async () => {
      const createScheduleDto = {
        title: 'New Schedule',
        type: 'WORKING_HOURS' as const,
        room: '507f1f77bcf86cd799439012',
        startDate: new Date('2024-01-01'),
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5],
      };

      mockRoomsService.findOne.mockResolvedValue(mockRoom);

      const result = await service.create(createScheduleDto);

      expect(result).toEqual(mockSchedule);
      expect(mockSave).toHaveBeenCalled();
      expect(mockRoomsService.findOne).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
      );
    });

    it('should create a schedule for a company', async () => {
      const createScheduleDto = {
        title: 'Company Holiday',
        type: 'UNAVAILABLE' as const,
        company: '507f1f77bcf86cd799439011',
        startDate: new Date('2024-12-25'),
        startTime: '00:00',
        endTime: '23:59',
        daysOfWeek: [],
      };

      mockCompaniesService.findOne.mockResolvedValue(mockCompany);

      const result = await service.create(createScheduleDto);

      expect(result).toEqual(mockSchedule);
      expect(mockCompaniesService.findOne).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });

    it('should throw BadRequestException if room not found', async () => {
      const createScheduleDto = {
        title: 'New Schedule',
        type: 'WORKING_HOURS' as const,
        room: '507f1f77bcf86cd799439012',
        startDate: new Date('2024-01-01'),
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [],
      };

      mockRoomsService.findOne.mockResolvedValue(null);

      await expect(service.create(createScheduleDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if company not found', async () => {
      const createScheduleDto = {
        title: 'Company Holiday',
        type: 'UNAVAILABLE' as const,
        company: '507f1f77bcf86cd799439011',
        startDate: new Date('2024-12-25'),
        startTime: '00:00',
        endTime: '23:59',
        daysOfWeek: [],
      };

      mockCompaniesService.findOne.mockResolvedValue(null);

      await expect(service.create(createScheduleDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of schedules', async () => {
      const schedules = [mockSchedule];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(schedules),
      };

      mockScheduleModel.find.mockReturnValue(mockChain);

      const result = await service.findAll();

      expect(result).toEqual(schedules);
      expect(mockScheduleModel.find).toHaveBeenCalled();
    });

    it('should filter schedules by room', async () => {
      const queryParams = { room: '507f1f77bcf86cd799439012' };
      const schedules = [mockSchedule];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(schedules),
      };

      mockScheduleModel.find.mockReturnValue(mockChain);

      const result = await service.findAll(queryParams);

      expect(result).toEqual(schedules);
      expect(mockScheduleModel.find).toHaveBeenCalledWith({
        room: '507f1f77bcf86cd799439012',
      });
    });

    it('should filter schedules by type', async () => {
      const queryParams = { type: ScheduleType.WORKING_HOURS };
      const schedules = [mockSchedule];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(schedules),
      };

      mockScheduleModel.find.mockReturnValue(mockChain);

      const result = await service.findAll(queryParams);

      expect(result).toEqual(schedules);
      expect(mockScheduleModel.find).toHaveBeenCalledWith({
        type: ScheduleType.WORKING_HOURS,
      });
    });
  });

  describe('findOne', () => {
    it('should return a schedule by id', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSchedule),
      };

      mockScheduleModel.findById.mockReturnValue(mockChain);

      const result = await service.findOne('507f1f77bcf86cd799439013');

      expect(result).toEqual(mockSchedule);
      expect(mockScheduleModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439013',
      );
    });

    it('should throw NotFoundException if schedule not found', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockScheduleModel.findById.mockReturnValue(mockChain);

      await expect(service.findOne('507f1f77bcf86cd799439013')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for invalid id format', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByRoom', () => {
    it('should return schedules for a specific room', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const schedules = [mockSchedule];

      mockRoomsService.findOne.mockResolvedValue(mockRoom);

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(schedules),
      };

      mockScheduleModel.find.mockReturnValue(mockChain);

      const result = await service.findByRoom(roomId);

      expect(result).toEqual(schedules);
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

  describe('getWorkingHours', () => {
    it('should return working hours for a room on a specific date', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const date = new Date('2024-02-15'); // Thursday
      const workingHours = [mockSchedule];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(workingHours),
      };

      mockScheduleModel.find.mockReturnValue(mockChain);

      const result = await service.getWorkingHours(roomId, date);

      expect(result).toEqual(workingHours);
      expect(mockScheduleModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          room: roomId,
          type: ScheduleType.WORKING_HOURS,
          isActive: true,
        }),
      );
    });

    it('should throw BadRequestException for invalid room id format', async () => {
      const date = new Date('2024-02-15');

      await expect(service.getWorkingHours('invalid-id', date)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUnavailableTimeSlots', () => {
    it('should return unavailable time slots for a room on a specific date', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const date = new Date('2024-02-15');
      const unavailableSlots = [
        {
          ...mockSchedule,
          type: ScheduleType.UNAVAILABLE,
          name: 'Maintenance',
        },
      ];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(unavailableSlots),
      };

      mockScheduleModel.find.mockReturnValue(mockChain);

      const result = await service.getUnavailableTimeSlots(roomId, date);

      expect(result).toEqual(unavailableSlots);
      expect(mockScheduleModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          room: roomId,
          type: ScheduleType.UNAVAILABLE,
          isActive: true,
        }),
      );
    });
  });

  describe('isTimeSlotAvailable', () => {
    it('should return true if time slot is available', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const date = new Date('2024-02-15');
      const startTime = '10:00';
      const endTime = '11:00';

      // Mock working hours that include the requested time
      const workingHours = [
        {
          ...mockSchedule,
          startTime: '09:00',
          endTime: '17:00',
        },
      ];

      // Mock no unavailable slots
      const unavailableSlots = [];

      jest
        .spyOn(service, 'getWorkingHours')
        .mockResolvedValue(workingHours as any);
      jest
        .spyOn(service, 'getUnavailableTimeSlots')
        .mockResolvedValue(unavailableSlots as any);

      const result = await service.isTimeSlotAvailable(
        roomId,
        date,
        startTime,
        endTime,
      );

      expect(result).toBe(true);
    });

    it('should return false if time slot is outside working hours', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const date = new Date('2024-02-15');
      const startTime = '18:00';
      const endTime = '19:00';

      // Mock working hours that don't include the requested time
      const workingHours = [
        {
          ...mockSchedule,
          startTime: '09:00',
          endTime: '17:00',
        },
      ];

      jest
        .spyOn(service, 'getWorkingHours')
        .mockResolvedValue(workingHours as any);

      const result = await service.isTimeSlotAvailable(
        roomId,
        date,
        startTime,
        endTime,
      );

      expect(result).toBe(false);
    });

    it('should return false if time slot conflicts with unavailable periods', async () => {
      const roomId = '507f1f77bcf86cd799439012';
      const date = new Date('2024-02-15');
      const startTime = '10:00';
      const endTime = '11:00';

      // Mock working hours that include the requested time
      const workingHours = [
        {
          ...mockSchedule,
          startTime: '09:00',
          endTime: '17:00',
        },
      ];

      // Mock unavailable slot that conflicts
      const unavailableSlots = [
        {
          ...mockSchedule,
          type: ScheduleType.UNAVAILABLE,
          startTime: '10:30',
          endTime: '11:30',
        },
      ];

      jest
        .spyOn(service, 'getWorkingHours')
        .mockResolvedValue(workingHours as any);
      jest
        .spyOn(service, 'getUnavailableTimeSlots')
        .mockResolvedValue(unavailableSlots as any);

      const result = await service.isTimeSlotAvailable(
        roomId,
        date,
        startTime,
        endTime,
      );

      expect(result).toBe(false);
    });
  });

  describe('update', () => {
    it('should update a schedule', async () => {
      const updateScheduleDto = {
        title: 'Updated Schedule',
        startTime: '08:00',
        endTime: '18:00',
      };

      const updatedSchedule = { ...mockSchedule, ...updateScheduleDto };

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updatedSchedule),
      };

      mockScheduleModel.findByIdAndUpdate.mockReturnValue(mockChain);

      const result = await service.update(
        '507f1f77bcf86cd799439013',
        updateScheduleDto,
      );

      expect(result).toEqual(updatedSchedule);
      expect(mockScheduleModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439013',
        updateScheduleDto,
        { new: true },
      );
    });

    it('should throw NotFoundException if schedule not found', async () => {
      const updateScheduleDto = { title: 'Updated Schedule' };

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockScheduleModel.findByIdAndUpdate.mockReturnValue(mockChain);

      await expect(
        service.update('507f1f77bcf86cd799439013', updateScheduleDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a schedule', async () => {
      mockScheduleModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSchedule),
      });

      await service.remove('507f1f77bcf86cd799439013');

      expect(mockScheduleModel.findByIdAndDelete).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439013',
      );
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockScheduleModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('507f1f77bcf86cd799439013')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for invalid id format', async () => {
      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
