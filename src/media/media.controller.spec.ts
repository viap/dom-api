import 'reflect-metadata';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

describe('MediaController', () => {
  let controller: MediaController;
  const mediaService = {
    findAll: jest.fn(),
    findAllAdmin: jest.fn(),
    findOne: jest.fn(),
    getContent: jest.fn(),
    getThumbnail: jest.fn(),
    create: jest.fn(),
    upload: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MediaController(mediaService as unknown as MediaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should mark public reads as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, MediaController.prototype.findAll),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, MediaController.prototype.getContent),
    ).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        MediaController.prototype.getThumbnail,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, MediaController.prototype.findOne),
    ).toBe(true);
  });

  it('should restrict admin routes to admin and editor', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, MediaController.prototype.findAllAdmin),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, MediaController.prototype.create),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, MediaController.prototype.upload),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, MediaController.prototype.update),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, MediaController.prototype.remove),
    ).toEqual([Role.Admin, Role.Editor]);
  });

  it('should reject upload without a file', () => {
    expect(() => controller.upload(undefined, {})).toThrow(BadRequestException);
  });

  it('should stream media content through the response object', async () => {
    mediaService.getContent.mockResolvedValue({
      path: '/tmp/media.png',
      mimeType: 'image/png',
    });
    const response = {
      type: jest.fn(),
      sendFile: jest.fn((_path, cb) => cb()),
    };

    await controller.getContent('507f1f77bcf86cd799439011', response as never);

    expect(mediaService.getContent).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
    );
    expect(response.type).toHaveBeenCalledWith('image/png');
    expect(response.sendFile).toHaveBeenCalledWith(
      '/tmp/media.png',
      expect.any(Function),
    );
  });

  it('should stream media thumbnail through the response object', async () => {
    mediaService.getThumbnail.mockResolvedValue({
      path: '/tmp/media-thumb.png',
      mimeType: 'image/png',
    });
    const response = {
      type: jest.fn(),
      sendFile: jest.fn((_path, cb) => cb()),
    };

    await controller.getThumbnail(
      '507f1f77bcf86cd799439011',
      response as never,
    );

    expect(mediaService.getThumbnail).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
    );
    expect(response.type).toHaveBeenCalledWith('image/png');
    expect(response.sendFile).toHaveBeenCalledWith(
      '/tmp/media-thumb.png',
      expect.any(Function),
    );
  });

  it('should map ENOENT while streaming content to 404', async () => {
    mediaService.getContent.mockResolvedValue({
      path: '/tmp/missing.png',
      mimeType: 'image/png',
    });
    const response = {
      type: jest.fn(),
      sendFile: jest.fn((_path, cb) => cb({ code: 'ENOENT' })),
    };

    await expect(
      controller.getContent('507f1f77bcf86cd799439011', response as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('should map unknown streaming content error to 500', async () => {
    mediaService.getContent.mockResolvedValue({
      path: '/tmp/missing.png',
      mimeType: 'image/png',
    });
    const response = {
      type: jest.fn(),
      sendFile: jest.fn((_path, cb) => cb({ code: 'EIO' })),
    };

    await expect(
      controller.getContent('507f1f77bcf86cd799439011', response as never),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('should map ENOENT while streaming thumbnail to 404', async () => {
    mediaService.getThumbnail.mockResolvedValue({
      path: '/tmp/missing-thumb.png',
      mimeType: 'image/png',
    });
    const response = {
      type: jest.fn(),
      sendFile: jest.fn((_path, cb) => cb({ code: 'ENOENT' })),
    };

    await expect(
      controller.getThumbnail('507f1f77bcf86cd799439011', response as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('should map unknown streaming thumbnail error to 500', async () => {
    mediaService.getThumbnail.mockResolvedValue({
      path: '/tmp/missing-thumb.png',
      mimeType: 'image/png',
    });
    const response = {
      type: jest.fn(),
      sendFile: jest.fn((_path, cb) => cb({ code: 'EIO' })),
    };

    await expect(
      controller.getThumbnail('507f1f77bcf86cd799439011', response as never),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
