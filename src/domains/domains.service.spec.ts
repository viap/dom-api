import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainCode } from './enums/domain-code.enum';
import { Domain } from './schemas/domain.schema';
import { DomainsService } from './domains.service';

describe('DomainsService', () => {
  let service: DomainsService;

  const mockDomainModel = {
    findOne: jest.fn(),
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
    const domain = { _id: '507f1f77bcf86cd799439032', code: DomainCode.Academy };
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
});
