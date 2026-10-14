import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { imageSize } from 'image-size';
import { copyFile, mkdir, unlink, writeFile } from 'fs/promises';
import sharp from 'sharp';
import { DomainEvent } from '@/events/schemas/domain-event.schema';
import { PageBlockType } from '@/pages/enums/page-block-type.enum';
import { Page } from '@/pages/schemas/page.schema';
import { Partner } from '@/partners/schemas/partner.schema';
import { Person } from '@/people/schemas/person.schema';
import { MediaKind } from './enums/media-kind.enum';
import { MediaService } from './media.service';
import { Media } from './schemas/media.schema';
import { UploadedMediaFile } from './types/uploaded-media-file.interface';

jest.mock('fs/promises', () => ({
  copyFile: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock('image-size', () => ({
  imageSize: jest.fn(),
}));

jest.mock('sharp', () =>
  jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    toFormat: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue(undefined),
  })),
);

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
    folder: 'events',
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

  const createLeanChain = (result: unknown) => ({
    select: jest.fn().mockReturnThis(),
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
      distinct: jest.fn(),
    },
  );

  const mockPageModel = {
    find: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockDomainEventModel = {
    find: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockPersonModel = {
    find: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockPartnerModel = {
    find: jest.fn(),
    updateMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: getModelToken(Media.name),
          useValue: mockMediaModel,
        },
        {
          provide: getModelToken(Page.name),
          useValue: mockPageModel,
        },
        {
          provide: getModelToken(DomainEvent.name),
          useValue: mockDomainEventModel,
        },
        {
          provide: getModelToken(Person.name),
          useValue: mockPersonModel,
        },
        {
          provide: getModelToken(Partner.name),
          useValue: mockPartnerModel,
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    jest.clearAllMocks();
    (copyFile as jest.Mock).mockResolvedValue(undefined);
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (unlink as jest.Mock).mockResolvedValue(undefined);
    (imageSize as jest.Mock).mockReturnValue({
      width: 1200,
      height: 800,
      type: 'png',
    });
    mockPageModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
    mockPageModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    });
    mockDomainEventModel.find.mockReturnValue(createLeanChain([]));
    mockPersonModel.find.mockReturnValue(createLeanChain([]));
    mockPartnerModel.find.mockReturnValue(createLeanChain([]));
    mockDomainEventModel.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    });
    mockDomainEventModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    });
    mockPersonModel.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    });
    mockPartnerModel.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    });
  });

  it('should only query published media on public list reads', async () => {
    mockMediaModel.find.mockReturnValue(createFindChain([uploadedMedia]));

    const result = await service.findAll({ limit: '10', offset: '0' });

    expect(result).toEqual([uploadedMedia]);
    expect(mockMediaModel.find).toHaveBeenCalledWith({ isPublished: true });
  });

  it('should filter public media reads by kind and title search', async () => {
    mockMediaModel.find.mockReturnValue(createFindChain([uploadedMedia]));

    await service.findAll({
      limit: '10',
      offset: '0',
      kind: MediaKind.Image,
      search: 'hero',
    });

    expect(mockMediaModel.find).toHaveBeenCalledWith({
      isPublished: true,
      kind: MediaKind.Image,
      title: {
        $regex: 'hero',
        $options: 'i',
      },
    });
  });

  it('should filter public media reads by folder', async () => {
    mockMediaModel.find.mockReturnValue(createFindChain([uploadedMedia]));

    await service.findAll({
      limit: '10',
      offset: '0',
      folder: 'events',
    });

    expect(mockMediaModel.find).toHaveBeenCalledWith({
      isPublished: true,
      folder: 'events',
    });
  });

  it('should create external media records only', async () => {
    const result = await service.create({
      kind: MediaKind.Image,
      url: 'https://cdn.example.com/assets/hero.png',
      title: ' Hero ',
      alt: ' Landing image ',
      folder: ' media-library ',
    });

    expect(result).toEqual(
      expect.objectContaining({
        url: 'https://cdn.example.com/assets/hero.png',
        title: 'Hero',
        alt: 'Landing image',
        folder: 'media-library',
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
    const result = await service.upload(
      {
        originalname: 'foundation-course-cover.png',
        mimetype: 'image/png',
        size: 512044,
        buffer: validPngBuffer,
      } as UploadedMediaFile,
      { folder: 'courses' },
    );

    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(sharp).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        kind: MediaKind.Image,
        mimeType: 'image/png',
        sizeBytes: 512044,
        width: 1200,
        height: 800,
        alt: '',
        folder: 'courses',
        isPublished: true,
        title: 'foundation course cover',
      }),
    );
    expect(result.storageKey).toMatch(/^\d{4}\/\d{2}\/.+\.png$/);
    expect(result.url).toBe(`/media/${uploadedMediaId}/content`);
  });

  it('should copy gif original as thumbnail instead of resizing', async () => {
    const gifBuffer = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x02, 0x03,
    ]);
    (imageSize as jest.Mock).mockReturnValue({
      width: 640,
      height: 480,
      type: 'gif',
    });

    const result = await service.upload({
      originalname: 'animated.gif',
      mimetype: 'image/gif',
      size: 1000,
      buffer: gifBuffer,
    } as UploadedMediaFile);

    expect(copyFile).toHaveBeenCalledTimes(1);
    expect(sharp).not.toHaveBeenCalled();
    expect(result.mimeType).toBe('image/gif');
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

  it('should map image size parse failures to bad request', async () => {
    (imageSize as jest.Mock).mockImplementationOnce(() => {
      throw new Error('invalid');
    });

    await expect(
      service.upload({
        originalname: 'broken.png',
        mimetype: 'image/png',
        size: 1200,
        buffer: validPngBuffer,
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

    expect(unlink).toHaveBeenCalledTimes(2);
  });

  it('should return content metadata for published uploaded media', async () => {
    mockMediaModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });

    const result = await service.getContent(uploadedMediaId);

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

  it('should return thumbnail metadata for published uploaded media', async () => {
    mockMediaModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });

    const result = await service.getThumbnail(uploadedMediaId);

    expect(result.mimeType).toBe('image/png');
    expect(result.path).toContain(uploadedMedia.storageKey);
  });

  it('should derive thumbnail mime type from thumbnail file extension', async () => {
    mockMediaModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...uploadedMedia,
          storageKey: '2026/04/hero.webp',
          mimeType: 'image/png',
        }),
      }),
    });

    const result = await service.getThumbnail(uploadedMediaId);

    expect(result.mimeType).toBe('image/webp');
  });

  it('should reject thumbnail access for external media', async () => {
    mockMediaModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(externalMedia),
      }),
    });

    await expect(service.getThumbnail(externalMedia._id)).rejects.toThrow(
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
        $set: {
          title: 'Updated title',
          alt: 'Updated alt',
          isPublished: false,
        },
      },
      { new: true },
    );
    expect(result.isPublished).toBe(false);
  });

  it('should normalize and clear folder values on update', async () => {
    mockMediaModel.findByIdAndUpdate
      .mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...uploadedMedia,
            folder: 'library',
          }),
        }),
      })
      .mockReturnValueOnce({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...uploadedMedia,
            folder: undefined,
          }),
        }),
      });

    await service.update(uploadedMediaId, { folder: '  library  ' });
    expect(mockMediaModel.findByIdAndUpdate).toHaveBeenNthCalledWith(
      1,
      uploadedMediaId,
      {
        $set: { folder: 'library' },
      },
      { new: true },
    );

    await service.update(uploadedMediaId, { folder: '   ' });
    expect(mockMediaModel.findByIdAndUpdate).toHaveBeenNthCalledWith(
      2,
      uploadedMediaId,
      {
        $unset: { folder: '' },
      },
      { new: true },
    );
  });

  it('should delete uploaded files after removing the record', async () => {
    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });
    mockMediaModel.findByIdAndDelete.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });

    await expect(service.remove(uploadedMediaId)).resolves.toBe(true);

    expect(unlink).toHaveBeenCalledTimes(2);
    expect(mockMediaModel.findByIdAndDelete).toHaveBeenCalledWith(
      uploadedMediaId,
    );
  });

  it('should tolerate missing thumbnail files during delete', async () => {
    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });
    mockMediaModel.findByIdAndDelete.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });
    (unlink as jest.Mock).mockRejectedValueOnce({ code: 'ENOENT' });

    await expect(service.remove(uploadedMediaId)).resolves.toBe(true);
    expect(unlink).toHaveBeenCalledTimes(2);
  });

  it('should warn and continue when non-ENOENT cleanup fails', async () => {
    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });
    mockMediaModel.findByIdAndDelete.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });
    (unlink as jest.Mock).mockRejectedValueOnce({
      code: 'EACCES',
      message: 'denied',
    });
    const warnSpy = jest.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).logger,
      'warn',
    );

    await expect(service.remove(uploadedMediaId)).resolves.toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should cleanup page/event/people/partner references on delete', async () => {
    const pageDoc = {
      _id: '507f1f77bcf86cd799439211',
      blocks: [
        {
          id: 'r1',
          type: PageBlockType.RichText,
          media: { mediaId: uploadedMediaId, alt: 'alt' },
        },
        {
          id: 'h1',
          type: PageBlockType.Hero,
          backgroundMedia: { mediaId: uploadedMediaId },
        },
        {
          id: 'g1',
          type: PageBlockType.Gallery,
          items: [{ mediaId: uploadedMediaId }],
        },
        {
          id: 'g2',
          type: PageBlockType.Gallery,
          items: [{ mediaId: uploadedMediaId }, { mediaId: 'other-media' }],
        },
      ],
    };

    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });
    mockMediaModel.findByIdAndDelete.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });
    mockPageModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([pageDoc]),
    });

    mockDomainEventModel.find.mockReturnValue(
      createLeanChain([{ _id: '507f1f77bcf86cd799439311' }]),
    );
    mockPersonModel.find.mockReturnValue(
      createLeanChain([{ _id: '507f1f77bcf86cd799439322' }]),
    );
    mockPartnerModel.find.mockReturnValue(
      createLeanChain([{ _id: '507f1f77bcf86cd799439333' }]),
    );

    await expect(service.remove(uploadedMediaId)).resolves.toBe(true);

    expect(mockPageModel.updateOne).toHaveBeenCalledWith(
      { _id: pageDoc._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          blocks: expect.any(Array),
        }),
      }),
      expect.objectContaining({ runValidators: true }),
    );
    const updatedBlocks = mockPageModel.updateOne.mock.calls[0]?.[1]?.$set
      ?.blocks as Array<Record<string, unknown>>;
    expect(updatedBlocks.some((block) => block.id === 'g1')).toBe(false);
    const remainingGallery = updatedBlocks.find((block) => block.id === 'g2');
    expect(remainingGallery.items).toEqual([{ mediaId: 'other-media' }]);

    expect(mockDomainEventModel.updateMany).toHaveBeenCalledWith(
      { mediaId: uploadedMediaId },
      { $unset: { mediaId: '' } },
    );
    expect(mockPersonModel.updateMany).toHaveBeenCalledWith(
      { photoId: uploadedMediaId },
      { $unset: { photoId: '' } },
    );
    expect(mockPartnerModel.updateMany).toHaveBeenCalledWith(
      { logoId: uploadedMediaId },
      { $unset: { logoId: '' } },
    );
  });

  it('removes only matching Custom media from Page, Group, Event, and modal positions', async () => {
    const customBlock = (id: string, mediaId: string) => ({
      id,
      type: PageBlockType.EntityCollection,
      entityType: 'custom',
      layout: 'grid',
      items: [],
      customItems: [
        { title: `${id} removed`, mediaId: uploadedMediaId },
        { title: `${id} retained`, mediaId },
      ],
    });
    const modalButton = (block: unknown) => ({
      label: 'Open',
      type: 'block',
      block,
    });
    const customModalOwner = (id: string, block: unknown) => ({
      id,
      type: PageBlockType.EntityCollection,
      entityType: 'custom',
      layout: 'grid',
      items: [],
      customItems: [
        {
          title: `${id} card`,
          button: modalButton(block),
        },
      ],
    });
    const pageDoc = {
      _id: '507f1f77bcf86cd799439271',
      blocks: [
        customBlock('page-custom', 'page-other'),
        {
          id: 'page-rich-text',
          type: PageBlockType.RichText,
          buttons: [
            modalButton(customBlock('rich-modal-custom', 'rich-other')),
          ],
        },
        {
          id: 'page-hero',
          type: PageBlockType.Hero,
          items: [
            {
              title: 'Hero item',
              button: modalButton(
                customBlock('hero-modal-custom', 'hero-other'),
              ),
            },
          ],
        },
        {
          ...customBlock('button-owner-custom', 'owner-other'),
          customItems: [
            {
              title: 'Modal owner',
              button: modalButton(
                customBlock('item-modal-custom', 'item-other'),
              ),
            },
          ],
        },
        customModalOwner('rich-owner-custom', {
          id: 'custom-item-rich-modal',
          type: PageBlockType.RichText,
          media: { mediaId: uploadedMediaId, alt: 'removed' },
        }),
        customModalOwner('empty-gallery-owner-custom', {
          id: 'custom-item-empty-gallery-modal',
          type: PageBlockType.Gallery,
          items: [{ mediaId: uploadedMediaId }],
        }),
        {
          id: 'legacy-cta-modal-owner',
          type: PageBlockType.Cta,
          buttons: [
            modalButton({
              id: 'legacy-rich-modal',
              type: PageBlockType.RichText,
              media: { mediaId: uploadedMediaId },
            }),
          ],
        },
        {
          id: 'page-group',
          type: PageBlockType.Group,
          blocks: [
            customBlock('group-custom', 'group-other'),
            {
              id: 'group-cta',
              type: PageBlockType.Cta,
              buttons: [
                modalButton(
                  customBlock('group-modal-custom', 'group-modal-other'),
                ),
              ],
            },
            customModalOwner('group-gallery-owner-custom', {
              id: 'custom-item-group-gallery-modal',
              type: PageBlockType.Gallery,
              items: [
                { mediaId: uploadedMediaId },
                { mediaId: 'group-gallery-other' },
              ],
            }),
          ],
        },
      ],
    };
    const eventDoc = {
      _id: '507f1f77bcf86cd799439272',
      blocks: [
        customBlock('event-custom', 'event-other'),
        {
          id: 'event-cta',
          type: PageBlockType.Cta,
          buttons: [
            modalButton(customBlock('event-modal-custom', 'event-modal-other')),
          ],
        },
        customModalOwner('event-rich-owner-custom', {
          id: 'custom-item-event-rich-modal',
          type: PageBlockType.RichText,
          media: { mediaId: uploadedMediaId },
        }),
      ],
    };

    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });
    mockMediaModel.findByIdAndDelete.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });
    mockPageModel.find.mockReturnValue(createLeanChain([pageDoc]));
    mockDomainEventModel.find
      .mockReturnValueOnce(createLeanChain([]))
      .mockReturnValueOnce(createLeanChain([eventDoc]));

    await expect(service.remove(uploadedMediaId)).resolves.toBe(true);

    const updatedPageBlocks = mockPageModel.updateOne.mock.calls[0]?.[1]?.$set
      ?.blocks as Array<Record<string, any>>;
    const updatedEventBlocks = mockDomainEventModel.updateOne.mock.calls[0]?.[1]
      ?.$set?.blocks as Array<Record<string, any>>;
    const findCustom = (
      blocks: Array<Record<string, any>>,
      id: string,
    ): Record<string, any> | undefined => {
      for (const block of blocks) {
        if (block.id === id) return block;
        if (Array.isArray(block.blocks)) {
          const nested = findCustom(block.blocks, id);
          if (nested) return nested;
        }
        for (const button of block.buttons ?? []) {
          if (button.block?.id === id) return button.block;
        }
        for (const item of block.items ?? []) {
          if (item.button?.block?.id === id) return item.button.block;
        }
        for (const item of block.customItems ?? []) {
          if (item.button?.block?.id === id) return item.button.block;
        }
      }
      return undefined;
    };
    const assertCustomMediaCleanup = (
      blocks: Array<Record<string, any>>,
      id: string,
      retainedMediaId: string,
    ) => {
      const block = findCustom(blocks, id);
      expect(block).toBeDefined();
      expect(block?.customItems).toHaveLength(2);
      expect(block?.customItems[0]).toEqual({ title: `${id} removed` });
      expect(block?.customItems[1]).toEqual({
        title: `${id} retained`,
        mediaId: retainedMediaId,
      });
    };

    assertCustomMediaCleanup(updatedPageBlocks, 'page-custom', 'page-other');
    assertCustomMediaCleanup(
      updatedPageBlocks,
      'rich-modal-custom',
      'rich-other',
    );
    assertCustomMediaCleanup(
      updatedPageBlocks,
      'hero-modal-custom',
      'hero-other',
    );
    assertCustomMediaCleanup(
      updatedPageBlocks,
      'item-modal-custom',
      'item-other',
    );
    assertCustomMediaCleanup(updatedPageBlocks, 'group-custom', 'group-other');
    assertCustomMediaCleanup(
      updatedPageBlocks,
      'group-modal-custom',
      'group-modal-other',
    );
    assertCustomMediaCleanup(updatedEventBlocks, 'event-custom', 'event-other');
    assertCustomMediaCleanup(
      updatedEventBlocks,
      'event-modal-custom',
      'event-modal-other',
    );

    const richOwner = findCustom(updatedPageBlocks, 'rich-owner-custom');
    expect(richOwner?.customItems[0].button.block.media).toBeUndefined();
    const emptyGalleryOwner = findCustom(
      updatedPageBlocks,
      'empty-gallery-owner-custom',
    );
    expect(emptyGalleryOwner?.customItems[0].button).toBeUndefined();
    const groupGalleryOwner = findCustom(
      updatedPageBlocks,
      'group-gallery-owner-custom',
    );
    expect(groupGalleryOwner?.customItems[0].button.block.items).toEqual([
      { mediaId: 'group-gallery-other' },
    ]);
    const eventRichOwner = findCustom(
      updatedEventBlocks,
      'event-rich-owner-custom',
    );
    expect(eventRichOwner?.customItems[0].button.block.media).toBeUndefined();
    const legacyOwner = updatedPageBlocks.find(
      (block) => block.id === 'legacy-cta-modal-owner',
    );
    expect(legacyOwner?.buttons[0].block.media).toEqual({
      mediaId: uploadedMediaId,
    });

    expect(
      updatedPageBlocks.find((block) => block.id === 'page-group'),
    ).toBeDefined();
    expect(mockPageModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { 'blocks.buttons.block.customItems.mediaId': uploadedMediaId },
          {
            'blocks.blocks.customItems.button.block.customItems.mediaId':
              uploadedMediaId,
          },
          {
            'blocks.customItems.button.block.media.mediaId': uploadedMediaId,
          },
          {
            'blocks.blocks.customItems.button.block.items.mediaId':
              uploadedMediaId,
          },
        ]),
      }),
    );
    expect(mockDomainEventModel.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { 'blocks.buttons.block.customItems.mediaId': uploadedMediaId },
          {
            'blocks.customItems.button.block.customItems.mediaId':
              uploadedMediaId,
          },
          {
            'blocks.customItems.button.block.media.mediaId': uploadedMediaId,
          },
        ]),
      }),
    );
  });

  it('cleans root, group, and event HTML snippet media while preserving marker/config integrity', async () => {
    const marker = (id: string) =>
      `<span data-dom-html-snippet="button" data-dom-html-snippet-id="${id}"></span>`;
    const snippetHtml = (
      id: string,
      embeddedBlock: unknown,
      includeMalformedDuplicate = false,
    ) => ({
      id: `html-${id}`,
      type: PageBlockType.Html,
      content: `<p>Before</p>${marker(id)}${
        includeMalformedDuplicate
          ? `${marker(
              id,
            )}<span data-dom-html-snippet="future" data-dom-html-snippet-id="${id}"></span>`
          : ''
      }<p>After</p>`,
      snippets: [
        {
          id,
          type: 'button',
          button: { label: 'Open', type: 'block', block: embeddedBlock },
        },
      ],
    });
    const pageDoc = {
      _id: '507f1f77bcf86cd799439281',
      blocks: [
        snippetHtml(
          'root-gallery',
          {
            id: 'root-gallery-block',
            type: PageBlockType.Gallery,
            items: [{ mediaId: uploadedMediaId }],
          },
          true,
        ),
        {
          id: 'group',
          type: PageBlockType.Group,
          blocks: [
            snippetHtml('group-custom', {
              id: 'group-custom-block',
              type: PageBlockType.EntityCollection,
              entityType: 'custom',
              layout: 'grid',
              items: [],
              customItems: [
                { title: 'Card', mediaId: uploadedMediaId },
                { title: 'Keep', mediaId: 'other-media' },
              ],
            }),
          ],
        },
      ],
    };
    const eventDoc = {
      _id: '507f1f77bcf86cd799439282',
      blocks: [
        snippetHtml('event-gallery', {
          id: 'event-gallery-block',
          type: PageBlockType.Gallery,
          items: [{ mediaId: uploadedMediaId }],
        }),
      ],
    };

    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });
    mockMediaModel.findByIdAndDelete.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });
    mockPageModel.find.mockReturnValue(createLeanChain([pageDoc]));
    mockDomainEventModel.find
      .mockReturnValueOnce(createLeanChain([]))
      .mockReturnValueOnce(createLeanChain([eventDoc]));

    await service.remove(uploadedMediaId);

    const pageBlocks = mockPageModel.updateOne.mock.calls[0]?.[1]?.$set
      ?.blocks as Array<Record<string, any>>;
    const rootHtml = pageBlocks.find(
      (block) => block.id === 'html-root-gallery',
    );
    expect(rootHtml?.snippets).toEqual([]);
    expect(rootHtml?.content).not.toContain(
      'data-dom-html-snippet="button" data-dom-html-snippet-id="root-gallery"',
    );
    expect(rootHtml?.content).toContain(
      'data-dom-html-snippet="future" data-dom-html-snippet-id="root-gallery"',
    );
    expect(rootHtml?.content).toContain('<p>Before</p>');
    expect(rootHtml?.content).toContain('<p>After</p>');

    const groupHtml = pageBlocks.find((block) => block.id === 'group')
      ?.blocks[0];
    expect(groupHtml.snippets).toHaveLength(1);
    expect(groupHtml.content).toContain('group-custom');
    expect(groupHtml.snippets[0].button.block.customItems[0]).toEqual({
      title: 'Card',
    });
    expect(groupHtml.snippets[0].button.block.customItems[1]).toEqual({
      title: 'Keep',
      mediaId: 'other-media',
    });

    const eventBlocks = mockDomainEventModel.updateOne.mock.calls[0]?.[1]?.$set
      ?.blocks as Array<Record<string, any>>;
    expect(eventBlocks[0].snippets).toEqual([]);
    expect(eventBlocks[0].content).not.toContain('event-gallery');

    expect(mockPageModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          {
            'blocks.snippets.button.block.items.mediaId': uploadedMediaId,
          },
          {
            'blocks.blocks.snippets.button.block.customItems.mediaId':
              uploadedMediaId,
          },
        ]),
      }),
    );
    expect(mockDomainEventModel.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          {
            'blocks.snippets.button.block.items.mediaId': uploadedMediaId,
          },
        ]),
      }),
    );
  });

  it('drops a group when deleting media empties its only child', async () => {
    const pageDoc = {
      _id: '507f1f77bcf86cd799439244',
      blocks: [
        {
          id: 'grp',
          type: PageBlockType.Group,
          blocks: [
            {
              id: 'gc1',
              type: PageBlockType.Gallery,
              items: [{ mediaId: uploadedMediaId }],
            },
          ],
        },
        { id: 'keep', type: PageBlockType.RichText, title: 'Keep me' },
      ],
    };

    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });
    mockMediaModel.findByIdAndDelete.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });
    mockPageModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([pageDoc]),
    });

    await expect(service.remove(uploadedMediaId)).resolves.toBe(true);

    const updatedBlocks = mockPageModel.updateOne.mock.calls[0]?.[1]?.$set
      ?.blocks as Array<Record<string, unknown>>;
    // The now-empty group is dropped (not left as blocks: []), the sibling stays.
    expect(updatedBlocks.some((block) => block.id === 'grp')).toBe(false);
    expect(updatedBlocks.some((block) => block.id === 'keep')).toBe(true);
  });

  it('keeps a group but strips media from a surviving child', async () => {
    const pageDoc = {
      _id: '507f1f77bcf86cd799439255',
      blocks: [
        {
          id: 'grp',
          type: PageBlockType.Group,
          blocks: [
            {
              id: 'gc1',
              type: PageBlockType.RichText,
              media: { mediaId: uploadedMediaId },
            },
            {
              id: 'gc2',
              type: PageBlockType.Gallery,
              items: [{ mediaId: uploadedMediaId }, { mediaId: 'other-media' }],
            },
          ],
        },
      ],
    };

    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });
    mockMediaModel.findByIdAndDelete.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(uploadedMedia),
      }),
    });
    mockPageModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([pageDoc]),
    });

    await expect(service.remove(uploadedMediaId)).resolves.toBe(true);

    const updatedBlocks = mockPageModel.updateOne.mock.calls[0]?.[1]?.$set
      ?.blocks as Array<Record<string, any>>;
    const group = updatedBlocks.find((block) => block.id === 'grp');
    expect(group).toBeDefined();
    const children = (group?.blocks || []) as Array<Record<string, any>>;
    // richText child kept (media stripped), gallery child kept with the other image.
    expect(children.find((c) => c.id === 'gc1')?.media).toBeUndefined();
    expect(children.find((c) => c.id === 'gc2')?.items).toEqual([
      { mediaId: 'other-media' },
    ]);
  });

  it('should not delete media when cleanup fails', async () => {
    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(uploadedMedia),
    });
    mockPageModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: '507f1f77bcf86cd799439411',
          blocks: [
            {
              id: 'g1',
              type: PageBlockType.Gallery,
              items: [{ mediaId: uploadedMediaId }],
            },
          ],
        },
      ]),
    });
    mockPageModel.updateOne.mockReturnValue({
      exec: jest.fn().mockRejectedValue(new Error('page update failed')),
    });

    await expect(service.remove(uploadedMediaId)).rejects.toThrow(
      'page update failed',
    );
    expect(mockMediaModel.findByIdAndDelete).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });

  it('should throw not found if media is missing in delete', async () => {
    mockMediaModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(service.remove(uploadedMediaId)).rejects.toThrow(
      NotFoundException,
    );
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
        .mockResolvedValue([
          { _id: uploadedMediaId },
          { _id: externalMedia._id },
        ]),
    });

    await expect(
      service.existingPublishedIds([uploadedMediaId, externalMedia._id]),
    ).resolves.toEqual(new Set([uploadedMediaId, externalMedia._id]));
    expect(mockMediaModel.find).toHaveBeenCalledWith({
      _id: { $in: [uploadedMediaId, externalMedia._id] },
      isPublished: true,
    });
  });

  it('should filter admin media reads by folder', async () => {
    mockMediaModel.find.mockReturnValue(createFindChain([uploadedMedia]));

    await service.findAllAdmin({
      folder: 'events',
      limit: '10',
      offset: '0',
    });

    expect(mockMediaModel.find).toHaveBeenCalledWith({
      folder: 'events',
    });
  });

  it('should filter admin media reads by publication status when provided', async () => {
    mockMediaModel.find.mockReturnValue(createFindChain([uploadedMedia]));

    await service.findAllAdmin({
      isPublished: 'true',
      limit: '10',
      offset: '0',
    });

    expect(mockMediaModel.find).toHaveBeenCalledWith({
      isPublished: true,
    });

    await service.findAllAdmin({
      isPublished: 'false',
      limit: '10',
      offset: '0',
    });

    expect(mockMediaModel.find).toHaveBeenLastCalledWith({
      isPublished: false,
    });
  });

  it('should filter admin media reads by boolean publication status', async () => {
    mockMediaModel.find.mockReturnValue(createFindChain([uploadedMedia]));

    await service.findAllAdmin({
      isPublished: true,
      limit: '10',
      offset: '0',
    });

    expect(mockMediaModel.find).toHaveBeenCalledWith({
      isPublished: true,
    });

    await service.findAllAdmin({
      isPublished: false,
      limit: '10',
      offset: '0',
    });

    expect(mockMediaModel.find).toHaveBeenLastCalledWith({
      isPublished: false,
    });
  });

  it('should keep admin media reads unfiltered by publication status when omitted', async () => {
    mockMediaModel.find.mockReturnValue(createFindChain([uploadedMedia]));

    await service.findAllAdmin({
      limit: '10',
      offset: '0',
    });

    expect(mockMediaModel.find).toHaveBeenCalledWith({});
  });

  it('should return sorted non-empty admin folders', async () => {
    mockMediaModel.distinct.mockResolvedValue([
      'z-folder',
      '',
      'a-folder',
      ' ',
      'm-folder',
    ]);

    await expect(service.findAllAdminFolders()).resolves.toEqual([
      'a-folder',
      'm-folder',
      'z-folder',
    ]);
    expect(mockMediaModel.distinct).toHaveBeenCalledWith('folder');
  });
});
