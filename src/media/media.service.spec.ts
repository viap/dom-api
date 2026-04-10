import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { Media } from './schemas/media.schema';

describe('MediaService', () => {
  let service: MediaService;

  const mockMedia = {
    _id: '507f1f77bcf86cd799439011',
    kind: 'image',
    storageKey: 'hero/image.png',
    url: 'https://example.com/image.png',
    title: 'Hero',
    alt: 'Hero image',
    isPublished: true,
    schemaVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSave = jest.fn().mockResolvedValue(mockMedia);
  const mockInstance = { save: mockSave };
  const mockMediaModel = Object.assign(
    jest.fn().mockImplementation(() => mockInstance),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
    },
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: getModelToken(Media.name),
          useValue: mockMediaModel,
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should only query published media on public list reads', async () => {
    const mockChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([mockMedia]),
    };
    mockMediaModel.find.mockReturnValue(mockChain);

    const result = await service.findAll({ limit: '10', offset: '0' });

    expect(result).toEqual([mockMedia]);
    expect(mockMediaModel.find).toHaveBeenCalledWith({ isPublished: true });
  });

  it('should throw ConflictException when storage key already exists', async () => {
    mockMediaModel.findOne.mockResolvedValue(mockMedia);

    await expect(
      service.create({
        kind: 'image' as any,
        storageKey: 'hero/image.png',
        url: 'https://example.com/image.png',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when published media is not found', async () => {
    const mockChain = {
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    };
    mockMediaModel.findOne.mockReturnValue(mockChain);

    await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(
      NotFoundException,
    );
  });
});
