import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from './companies.service';
import { Company } from './schemas/company.schema';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const mockCompany = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Company',
    description: 'A test company',
    address: '123 Test Street',
    phone: '+1-555-123-4567',
    email: 'test@company.com',
    website: 'https://testcompany.com',
    isActive: true,
    settings: {
      defaultBookingDuration: 60,
      advanceBookingDays: 30,
      cancellationPolicy: 'Standard',
      timeZone: 'UTC',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create mock instance methods
  const mockSave = jest.fn().mockResolvedValue(mockCompany);
  const mockInstance = {
    save: mockSave,
  };

  // Create mock model with both constructor and static methods
  const mockCompanyModel = Object.assign(
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
    },
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: getModelToken(Company.name),
          useValue: mockCompanyModel,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new company', async () => {
      const createCompanyDto = {
        name: 'New Company',
        address: '456 New Street',
        email: 'new@company.com',
      };

      mockCompanyModel.findOne.mockResolvedValue(null);

      const result = await service.create(createCompanyDto);

      expect(result).toEqual(mockCompany);
    });

    it('should throw ConflictException if company name already exists', async () => {
      const createCompanyDto = {
        name: 'Existing Company',
        address: '456 New Street',
      };

      mockCompanyModel.findOne.mockResolvedValue(mockCompany);

      await expect(service.create(createCompanyDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of companies', async () => {
      const companies = [mockCompany];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(companies),
      };

      mockCompanyModel.find.mockReturnValue(mockChain);

      const result = await service.findAll();

      expect(result).toEqual(companies);
      expect(mockCompanyModel.find).toHaveBeenCalled();
    });

    it('should filter by active status', async () => {
      const queryParams = { isActive: 'true' };
      const companies = [mockCompany];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(companies),
      };

      mockCompanyModel.find.mockReturnValue(mockChain);

      const result = await service.findAll(queryParams);

      expect(result).toEqual(companies);
      expect(mockCompanyModel.find).toHaveBeenCalledWith({ isActive: true });
    });
  });

  describe('findOne', () => {
    it('should return a company by id', async () => {
      const mockChain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockCompany),
      };

      mockCompanyModel.findById.mockReturnValue(mockChain);

      const result = await service.findOne('507f1f77bcf86cd799439011');

      expect(result).toEqual(mockCompany);
      expect(mockCompanyModel.findById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });

    it('should throw NotFoundException if company not found', async () => {
      const mockChain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockCompanyModel.findById.mockReturnValue(mockChain);

      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for invalid id format', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a company', async () => {
      const updateCompanyDto = {
        name: 'Updated Company',
        description: 'Updated description',
      };

      mockCompanyModel.findOne.mockResolvedValue(null);
      const mockChain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue({ ...mockCompany, ...updateCompanyDto }),
      };

      mockCompanyModel.findByIdAndUpdate.mockReturnValue(mockChain);

      const result = await service.update(
        '507f1f77bcf86cd799439011',
        updateCompanyDto,
      );

      expect(result.name).toBe(updateCompanyDto.name);
      expect(mockCompanyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        updateCompanyDto,
        { new: true },
      );
    });

    it('should throw ConflictException if updated name already exists', async () => {
      const updateCompanyDto = { name: 'Existing Company' };

      mockCompanyModel.findOne.mockResolvedValue(mockCompany);

      await expect(
        service.update('507f1f77bcf86cd799439011', updateCompanyDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if company not found', async () => {
      const updateCompanyDto = { name: 'Updated Company' };

      mockCompanyModel.findOne.mockResolvedValue(null);
      const mockChain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockCompanyModel.findByIdAndUpdate.mockReturnValue(mockChain);

      await expect(
        service.update('507f1f77bcf86cd799439011', updateCompanyDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a company', async () => {
      mockCompanyModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCompany),
      });

      await service.remove('507f1f77bcf86cd799439011');

      expect(mockCompanyModel.findByIdAndDelete).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
      );
    });

    it('should throw NotFoundException if company not found', async () => {
      mockCompanyModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for invalid id format', async () => {
      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByName', () => {
    it('should find a company by name', async () => {
      const mockChain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockCompany),
      };

      mockCompanyModel.findOne.mockReturnValue(mockChain);

      const result = await service.findByName('Test Company');

      expect(result).toEqual(mockCompany);
    });

    it('should return null if company not found', async () => {
      const mockChain = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockCompanyModel.findOne.mockReturnValue(mockChain);

      const result = await service.findByName('Non-existent Company');

      expect(result).toBeNull();
    });
  });

  describe('getActiveCompanies', () => {
    it('should return active companies only', async () => {
      const activeCompanies = [mockCompany];

      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(activeCompanies),
      };

      mockCompanyModel.find.mockReturnValue(mockChain);

      const result = await service.getActiveCompanies();

      expect(result).toEqual(activeCompanies);
      expect(mockCompanyModel.find).toHaveBeenCalledWith({ isActive: true });
    });
  });
});
