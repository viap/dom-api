import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainCode } from './enums/domain-code.enum';
import { Domain } from './schemas/domain.schema';
import { DomainsService } from './domains.service';

describe('DomainsService', () => {
  let service: DomainsService;

  const mockDomainModel = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainsService,
        {
          provide: getModelToken(Domain.name),
          useValue: mockDomainModel,
        },
      ],
    }).compile();

    service = module.get<DomainsService>(DomainsService);
    jest.clearAllMocks();
  });

  it('throws BadRequestException for invalid domain code', async () => {
    await expect(service.getActiveByCode(undefined as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockDomainModel.findOne).not.toHaveBeenCalled();
  });

  it('throws NotFoundException with code in message for missing active domain', async () => {
    mockDomainModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.getActiveByCode(DomainCode.Academy)).rejects.toThrow(
      `Active domain not found for code: ${DomainCode.Academy}`,
    );
  });

  it('returns active domain by code', async () => {
    const domain = {
      _id: '507f1f77bcf86cd799439032',
      code: DomainCode.Academy,
    };
    mockDomainModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(domain),
    });

    const result = await service.getActiveByCode(DomainCode.Academy);

    expect(mockDomainModel.findOne).toHaveBeenCalledWith({
      code: DomainCode.Academy,
      isActive: true,
    });
    expect(result).toEqual(domain);
  });

  it('throws BadRequestException for invalid slug format in getActiveBySlug', async () => {
    await expect(service.getActiveBySlug('Invalid Slug')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.getActiveBySlug('Invalid Slug')).rejects.toThrow(
      'Invalid domain slug format',
    );
    expect(mockDomainModel.findOne).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for slug with leading/trailing hyphens', async () => {
    await expect(service.getActiveBySlug('-academy')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.getActiveBySlug('academy-')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.getActiveBySlug('academy--test')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockDomainModel.findOne).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for slug exceeding 120 characters', async () => {
    const longSlug = 'a'.repeat(121);
    await expect(service.getActiveBySlug(longSlug)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockDomainModel.findOne).not.toHaveBeenCalled();
  });

  it('trims whitespace from slug before validation', async () => {
    const domain = {
      _id: '507f1f77bcf86cd799439042',
      slug: 'academy',
      isActive: true,
    };
    mockDomainModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(domain),
    });

    const result = await service.getActiveBySlug('  academy  ');

    expect(mockDomainModel.findOne).toHaveBeenCalledWith({
      slug: 'academy',
      isActive: true,
    });
    expect(result).toEqual(domain);
  });

  it('throws NotFoundException when getActiveBySlug does not find an active domain', async () => {
    mockDomainModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.getActiveBySlug('academy')).rejects.toThrow(
      'Active domain not found',
    );
  });

  it('returns active domain by slug', async () => {
    const domain = {
      _id: '507f1f77bcf86cd799439042',
      slug: 'academy',
      isActive: true,
    };
    mockDomainModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(domain),
    });

    const result = await service.getActiveBySlug('academy');

    expect(mockDomainModel.findOne).toHaveBeenCalledWith({
      slug: 'academy',
      isActive: true,
    });
    expect(result).toEqual(domain);
  });

  it('findOne queries active domains only for public access', async () => {
    const domain = {
      _id: '507f1f77bcf86cd799439041',
      title: 'Domain',
      isActive: true,
    };

    mockDomainModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(domain),
    });

    const result = await service.findOne('507f1f77bcf86cd799439041');

    expect(mockDomainModel.findOne).toHaveBeenCalledWith({
      _id: '507f1f77bcf86cd799439041',
      isActive: true,
    });
    expect(result).toEqual(domain);
  });

  it('findManyByIds queries active domains only for public access', async () => {
    mockDomainModel.find.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: '507f1f77bcf86cd799439041',
          title: 'Domain',
          isActive: true,
        },
      ]),
    });

    const result = await service.findManyByIds([
      '507f1f77bcf86cd799439041',
      'invalid-id',
    ]);

    expect(mockDomainModel.find).toHaveBeenCalledWith({
      _id: { $in: ['507f1f77bcf86cd799439041'] },
      isActive: true,
    });
    expect(result).toEqual({
      items: [
        {
          _id: '507f1f77bcf86cd799439041',
          title: 'Domain',
          isActive: true,
        },
      ],
    });
  });

  it('findAll returns only active domains for public access', async () => {
    const expectedDomains = [
      {
        _id: '507f1f77bcf86cd799439041',
        title: 'Domain A',
        isActive: true,
      },
    ];
    const lean = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(expectedDomains),
    });
    const sort = jest.fn().mockReturnValue({ lean });
    mockDomainModel.find.mockReturnValue({ sort });

    const result = await service.findAll();

    expect(mockDomainModel.find).toHaveBeenCalledWith({ isActive: true });
    expect(sort).toHaveBeenCalledWith({ order: 1, title: 1 });
    expect(result).toEqual(expectedDomains);
  });
});
