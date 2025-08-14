import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from '../companies/companies.service';
import { RoomsService } from './rooms.service';
import { Room } from './schemas/room.schema';

describe('RoomsService', () => {
  let service: RoomsService;

  const mockCompany = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Company',
    address: '123 Test Street',
    phone: '+1-555-123-4567',
    email: 'test@company.com',
    isActive: true,
  };

  const mockRoom = {
    _id: '507f1f77bcf86cd799439012',
    name: 'Conference Room A',
    description: 'Large conference room',
    company: mockCompany,
    capacity: 12,
    amenities: ['WiFi', 'Projector'],
    location: '2nd Floor',
    isActive: true,
    settings: {
      allowMultipleBookings: false,
      minimumBookingDuration: 30,
      maximumBookingDuration: 480,
      cleaningTimeAfterBooking: 15,
      advanceNoticeRequired: 2,
    },
    equipment: {
      projector: true,
      whiteboard: true,
      audioSystem: false,
      videoConferencing: false,
      wifi: true,
      airConditioning: true,
      other: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create mock instance methods
  const mockSave = jest.fn().mockResolvedValue(mockRoom);
  const mockInstance = {
    save: mockSave,
  };

  // Create mock model with both constructor and static methods
  const mockRoomModel = Object.assign(
    jest.fn().mockImplementation(() => mockInstance),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      create: jest.fn(),
      exec: jest.fn(),
      lean: jest.fn(),
      sort: jest.fn(),
      populate: jest.fn(),
    },
  );

  const mockCompaniesService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: getModelToken(Room.name),
          useValue: mockRoomModel,
        },
        {
          provide: CompaniesService,
          useValue: mockCompaniesService,
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new room', async () => {
      const createRoomDto = {
        name: 'New Room',
        company: '507f1f77bcf86cd799439011',
        capacity: 8,
        description: 'A new meeting room',
      };

      mockCompaniesService.findOne.mockResolvedValue(mockCompany);
      mockRoomModel.findOne.mockResolvedValue(null);

      const result = await service.create(createRoomDto);

      expect(result).toEqual(mockRoom);
      expect(mockSave).toHaveBeenCalled();
      expect(mockCompaniesService.findOne).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });

    it('should throw BadRequestException if company not found', async () => {
      const createRoomDto = {
        name: 'New Room',
        company: '507f1f77bcf86cd799439011',
        capacity: 8,
        description: 'A new meeting room',
      };

      mockCompaniesService.findOne.mockResolvedValue(null);

      await expect(service.create(createRoomDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if room name already exists in company', async () => {
      const createRoomDto = {
        name: 'Existing Room',
        company: '507f1f77bcf86cd799439011',
        capacity: 8,
        description: 'An existing meeting room',
      };

      mockCompaniesService.findOne.mockResolvedValue(mockCompany);
      mockRoomModel.findOne.mockResolvedValue(mockRoom);

      await expect(service.create(createRoomDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of rooms', async () => {
      const rooms = [mockRoom];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(rooms),
      };

      mockRoomModel.find.mockReturnValue(mockChain);

      const result = await service.findAll();

      expect(result).toEqual(rooms);
      expect(mockRoomModel.find).toHaveBeenCalled();
    });

    it('should filter rooms by company', async () => {
      const queryParams = { company: '507f1f77bcf86cd799439011' };
      const rooms = [mockRoom];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(rooms),
      };

      mockRoomModel.find.mockReturnValue(mockChain);

      const result = await service.findAll(queryParams);

      expect(result).toEqual(rooms);
      expect(mockRoomModel.find).toHaveBeenCalledWith({
        company: '507f1f77bcf86cd799439011',
      });
    });

    it('should filter rooms by capacity range', async () => {
      const queryParams = { minCapacity: '5', maxCapacity: '15' };
      const rooms = [mockRoom];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(rooms),
      };

      mockRoomModel.find.mockReturnValue(mockChain);

      const result = await service.findAll(queryParams);

      expect(result).toEqual(rooms);
      expect(mockRoomModel.find).toHaveBeenCalledWith({
        capacity: { $gte: 5, $lte: 15 },
      });
    });
  });

  describe('findOne', () => {
    it('should return a room by id', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRoom),
      };

      mockRoomModel.findById.mockReturnValue(mockChain);

      const result = await service.findOne('507f1f77bcf86cd799439012');

      expect(result).toEqual(mockRoom);
      expect(mockRoomModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
      );
    });

    it('should throw NotFoundException if room not found', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockRoomModel.findById.mockReturnValue(mockChain);

      await expect(service.findOne('507f1f77bcf86cd799439012')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for invalid id format', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByCompany', () => {
    it('should return rooms for a specific company', async () => {
      const companyId = '507f1f77bcf86cd799439011';
      const rooms = [mockRoom];

      mockCompaniesService.findOne.mockResolvedValue(mockCompany);

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(rooms),
      };

      mockRoomModel.find.mockReturnValue(mockChain);

      const result = await service.findByCompany(companyId);

      expect(result).toEqual(rooms);
      expect(mockCompaniesService.findOne).toHaveBeenCalledWith(companyId);
      expect(mockRoomModel.find).toHaveBeenCalledWith({
        company: companyId,
        isActive: true,
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      const companyId = '507f1f77bcf86cd799439011';

      mockCompaniesService.findOne.mockResolvedValue(null);

      await expect(service.findByCompany(companyId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid company id format', async () => {
      await expect(service.findByCompany('invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should update a room', async () => {
      const updateRoomDto = {
        name: 'Updated Room',
        capacity: 15,
      };

      const updatedRoom = { ...mockRoom, ...updateRoomDto };

      mockRoomModel.findOne.mockResolvedValue(null);

      const mockFindChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRoom),
      };

      mockRoomModel.findById.mockReturnValue(mockFindChain);

      const mockUpdateChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updatedRoom),
      };

      mockRoomModel.findByIdAndUpdate.mockReturnValue(mockUpdateChain);

      const result = await service.update(
        '507f1f77bcf86cd799439012',
        updateRoomDto,
      );

      expect(result).toEqual(updatedRoom);
      expect(mockRoomModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
        updateRoomDto,
        { new: true },
      );
    });

    it('should throw NotFoundException if room not found', async () => {
      const updateRoomDto = { name: 'Updated Room' };

      mockRoomModel.findOne.mockResolvedValue(null);

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockRoomModel.findByIdAndUpdate.mockReturnValue(mockChain);

      await expect(
        service.update('507f1f77bcf86cd799439012', updateRoomDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a room', async () => {
      mockRoomModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRoom),
      });

      await service.remove('507f1f77bcf86cd799439012');

      expect(mockRoomModel.findByIdAndDelete).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439012',
      );
    });

    it('should throw NotFoundException if room not found', async () => {
      mockRoomModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('507f1f77bcf86cd799439012')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveRooms', () => {
    it('should return active rooms only', async () => {
      const activeRooms = [mockRoom];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(activeRooms),
      };

      mockRoomModel.find.mockReturnValue(mockChain);

      const result = await service.getActiveRooms();

      expect(result).toEqual(activeRooms);
      expect(mockRoomModel.find).toHaveBeenCalledWith({ isActive: true });
    });
  });

  describe('findByCapacityRange', () => {
    it('should return rooms within capacity range', async () => {
      const rooms = [mockRoom];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(rooms),
      };

      mockRoomModel.find.mockReturnValue(mockChain);

      const result = await service.findByCapacityRange(5, 15);

      expect(result).toEqual(rooms);
      expect(mockRoomModel.find).toHaveBeenCalledWith({
        isActive: true,
        capacity: { $gte: 5, $lte: 15 },
      });
    });

    it('should work with minimum capacity only', async () => {
      const rooms = [mockRoom];

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(rooms),
      };

      mockRoomModel.find.mockReturnValue(mockChain);

      const result = await service.findByCapacityRange(5, undefined);

      expect(result).toEqual(rooms);
      expect(mockRoomModel.find).toHaveBeenCalledWith({
        isActive: true,
        capacity: { $gte: 5 },
      });
    });
  });
});
