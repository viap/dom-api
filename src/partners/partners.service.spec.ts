import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from '@/media/media.service';
import { PartnerType } from './enums/partner-type.enum';
import { Partner } from './schemas/partner.schema';
import { PartnersService } from './partners.service';

describe('PartnersService', () => {
  let service: PartnersService;

  const mockPartnerModel = jest.fn().mockImplementation((payload) => ({
    ...payload,
    save: jest.fn().mockResolvedValue(payload),
  }));
  const mockMediaService = {
    existsPublished: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnersService,
        { provide: getModelToken(Partner.name), useValue: mockPartnerModel },
        { provide: MediaService, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get<PartnersService>(PartnersService);
    jest.clearAllMocks();
    mockMediaService.existsPublished.mockResolvedValue(true);
  });

  it('should reject unpublished media references for public partner logos', async () => {
    mockMediaService.existsPublished.mockResolvedValue(false);

    await expect(
      service.create({
        title: 'DOM',
        type: PartnerType.Media,
        logoId: '507f1f77bcf86cd799439041',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
