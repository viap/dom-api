import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from '@/media/media.service';
import { PartnerType } from './enums/partner-type.enum';
import { Partner } from './schemas/partner.schema';
import { PartnersService } from './partners.service';

describe('PartnersService', () => {
  let service: PartnersService;

  const mockSave = jest.fn().mockImplementation(async (payload) => payload);
  const mockPublicListExec = jest.fn().mockResolvedValue([]);
  const mockPublicListChain = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: mockPublicListExec,
  };
  const mockAdminListExec = jest.fn().mockResolvedValue([]);
  const mockAdminListChain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: mockAdminListExec,
  };
  const mockFindOneExec = jest.fn().mockResolvedValue({
    _id: '507f1f77bcf86cd799439041',
    title: 'DOM',
  });
  const mockFindOneChain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: mockFindOneExec,
  };
  const mockFindByIdExec = jest.fn().mockResolvedValue({
    _id: '507f1f77bcf86cd799439041',
    title: 'DOM',
    contacts: [{ network: 'telegram', username: '@dom', hidden: false }],
  });
  const mockFindByIdChain = {
    lean: jest.fn().mockReturnThis(),
    exec: mockFindByIdExec,
  };

  const mockPartnerModel = Object.assign(
    jest.fn().mockImplementation((payload) => ({
      ...payload,
      save: jest.fn().mockImplementation(() => mockSave(payload)),
    })),
    {
      find: jest.fn().mockImplementation((query) =>
        query && query.isPublished === true
          ? mockPublicListChain
          : mockAdminListChain,
      ),
      findOne: jest.fn().mockReturnValue(mockFindOneChain),
      findById: jest.fn().mockReturnValue(mockFindByIdChain),
    },
  );
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
    mockFindOneExec.mockResolvedValue({
      _id: '507f1f77bcf86cd799439041',
      title: 'DOM',
    });
    mockFindByIdExec.mockResolvedValue({
      _id: '507f1f77bcf86cd799439041',
      title: 'DOM',
      contacts: [{ network: 'telegram', username: '@dom', hidden: false }],
    });
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

  it('should exclude contacts from public partner list', async () => {
    await service.findAll({});

    expect(mockPublicListChain.select).toHaveBeenCalledWith({ contacts: 0 });
  });

  it('should exclude contacts from public partner detail', async () => {
    await service.findOne('507f1f77bcf86cd799439041');

    expect(mockFindOneChain.select).toHaveBeenCalledWith({ contacts: 0 });
  });

  it('should include contacts for admin partner list', async () => {
    await service.findAllAdmin({});

    expect(mockAdminListChain.sort).toHaveBeenCalledWith({ title: 1 });
  });

  it('should include contacts for admin partner detail', async () => {
    const partner = await service.findOneAdmin('507f1f77bcf86cd799439041');

    expect(partner.contacts).toBeDefined();
  });
});
