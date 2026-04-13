import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { imageSize } from 'image-size';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { MediaKind } from './enums/media-kind.enum';
import { MediaService } from './media.service';
import { Media } from './schemas/media.schema';
import { UploadedMediaFile } from './types/uploaded-media-file.interface';

jest.mock('fs/promises', () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock('image-size', () => ({
  imageSize: jest.fn(),
}));

describe('MediaService', () => {
  let service: MediaService;

  const uploadedMediaId = '507f1f77bcf86cd799439011';
  const uploadedMedia = {
    _id: uploadedMediaId,
    kind: MediaKind.Image,
    storageKey: '2026/04/hero.png',
    url: `/media/${uploadedMediaId}/content`,
    title: 'Hero',
    alt: 'Hero image',
    mimeType: 'image/png',
    sizeBytes: 512044,
    width: 1200,
    height: 800,
    isPublished: true,
    schemaVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const externalMedia = {
    _id: '507f1f77bcf86cd799439012',
    kind: MediaKind.Image,
    url: 'https://cdn.example.com/hero.png',
    title: 'CDN Hero',
    alt: '',
    isPublished: true,
    schemaVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03, 0x04,
  ]);

  const createFindChain = (result: unknown) => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  });

  const mockMediaModel = Object.assign(
    jest.fn().mockImplementation((payload) => {
      const instance = {
        _id: payload._id ?? uploadedMediaId,
        ...payload,
        save: jest.fn().mockImplementation(async () => ({ ...instance })),
      };

      return instance;
    }),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
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
    (access as jest.Mock).mockResolvedValue(undefined);
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (unlink as jest.Mock).mockResolvedValue(undefined);
    (imageSize as jest.Mock).mockReturnValue({
      width: 1200,
      height: 800,
      type: 'png',
    });
  });

  it('should only query published media on public list reads', async () => {
    mockMediaModel.find.mockReturnValue(createFindChain([uploadedMedia]));

    const result = await service.findAll({ limit: '10', offset: '0' });

    expect(result).toEqual([uploadedMedia]);
    expect(mockMediaModel.find).toHaveBeenCalledWith({ isPublished: true });
  });

  it('should create external media records only', async () => {
    const result = await service.create({
      kind: MediaKind.Image,
      url: 'https://cdn.example.com/assets/hero.png',
      title: ' Hero ',
      alt: ' Landing image ',
    });

    expect(result).toEqual(
      expect.objectContaining({
        url: 'https://cdn.example.com/assets/hero.png',
        title: 'Hero',
        alt: 'Landing image',
      }),
    );
  });

  it('should reject non-external URLs in manual create flow', async () => {
    await expect(
      service.create({
        kind: MediaKind.Image,
        url: '/media/507f1f77bcf86cd799439011/content',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should upload an image and derive media metadata', async () => {
    const result = await service.upload({
      originalname: 'foundation-course-cover.png',
      mimetype: 'image/png',
      size: 512044,
      buffer: validPngBuffer,
    } as UploadedMediaFile);

    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        kind: MediaKind.Image,
        mimeType: 'image/png',
        sizeBytes: 512044,
        width: 1200,
        height: 800,
        alt: '',
        isPublished: true,
        title: 'foundation course cover',
      }),
    );
    expect(result.storageKey).toMatch(/^\d{4}\/\d{2}\/.+\.png$/);
    expect(result.url).toBe(`/media/${uploadedMediaId}/content`);
  });

  it('should reject files whose MIME type does not match the bytes', async () => {
    await expect(
      service.upload({
        originalname: 'hero.gif',
        mimetype: 'image/gif',
        size: 1200,
        buffer: validPngBuffer,
      } as UploadedMediaFile),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject invalid image bytes', async () => {
    await expect(
      service.upload({
        originalname: 'hero.png',
        mimetype: 'image/png',
        size: 1200,
        buffer: Buffer.from('not-an-image'),
      } as UploadedMediaFile),
    ).rejects.toThrow(BadRequestException);
  });

  it('should clean up the uploaded file if media save fails', async () => {
    mockMediaModel.mockImplementationOnce((payload) => ({
      _id: payload._id ?? uploadedMediaId,
      ...payload,
      save: jest.fn().mockRejectedValue(new Error('db failed')),
    }));

    await expect(
      service.upload({
        originalname: 'cleanup.png',
        mimetype: 'image/png',
        size: 100,
        buffer: validPngBuffer,
      } as UploadedMediaFile),
    ).rejects.toThrow('db failed');

    expect(unlink).toHaveBeenCalled();
  });

  it('should return content metadata for published uploaded media', async () => {
    mockMediaModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });

    const result = await service.getContent(uploadedMediaId);

    expect(access).toHaveBeenCalled();
    expect(result.mimeType).toBe('image/png');
    expect(result.path).toContain(uploadedMedia.storageKey);
  });

  it('should reject content access for external media', async () => {
    mockMediaModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(externalMedia),
      }),
    });

    await expect(service.getContent(externalMedia._id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update editable metadata only', async () => {
    mockMediaModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...uploadedMedia,
          title: 'Updated title',
          alt: 'Updated alt',
          isPublished: false,
        }),
      }),
    });

    const result = await service.update(uploadedMediaId, {
      title: ' Updated title ',
      alt: ' Updated alt ',
      isPublished: false,
    });

    expect(mockMediaModel.findByIdAndUpdate).toHaveBeenCalledWith(
      uploadedMediaId,
      {
        title: 'Updated title',
        alt: 'Updated alt',
        isPublished: false,
      },
      { new: true },
    );
    expect(result.isPublished).toBe(false);
  });

  it('should delete uploaded files before removing the record', async () => {
    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });
    mockMediaModel.findByIdAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });

    await expect(service.remove(uploadedMediaId)).resolves.toBe(true);

    expect(unlink).toHaveBeenCalled();
    expect(mockMediaModel.findByIdAndDelete).toHaveBeenCalledWith(
      uploadedMediaId,
    );
  });

  it('should keep the DB record when file deletion fails', async () => {
    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });
    (unlink as jest.Mock).mockRejectedValueOnce(new Error('disk failed'));

    await expect(service.remove(uploadedMediaId)).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mockMediaModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('should only count published media in existsPublished', async () => {
    mockMediaModel.countDocuments.mockResolvedValueOnce(1);

    await expect(service.existsPublished(uploadedMediaId)).resolves.toBe(true);
    expect(mockMediaModel.countDocuments).toHaveBeenCalledWith({
      _id: uploadedMediaId,
      isPublished: true,
    });
  });

  it('should only return published IDs from existingPublishedIds', async () => {
    mockMediaModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest
        .fn()
        .mockResolvedValue([{ _id: uploadedMediaId }, { _id: externalMedia._id }]),
    });

    await expect(
      service.existingPublishedIds([uploadedMediaId, externalMedia._id]),
    ).resolves.toEqual(new Set([uploadedMediaId, externalMedia._id]));
    expect(mockMediaModel.find).toHaveBeenCalledWith({
      _id: { $in: [uploadedMediaId, externalMedia._id] },
      isPublished: true,
    });
  });
});
