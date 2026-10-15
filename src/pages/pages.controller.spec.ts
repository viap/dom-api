import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { EntityCollectionEntityType } from './enums/entity-collection-entity-type.enum';
import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

describe('PagesController', () => {
  let controller: PagesController;

  beforeEach(() => {
    controller = new PagesController({
      findAll: jest.fn(),
      findManyByIds: jest.fn(),
      findManyAdminByIds: jest.fn(),
      findAllGlobal: jest.fn(),
      findAllAdmin: jest.fn(),
      findAllByDomainIdAdmin: jest.fn(),
      findAdminOne: jest.fn(),
      findAllByDomainSlug: jest.fn(),
      findOne: jest.fn(),
      findGlobalHomepage: jest.fn(),
      findOneGlobalBySlug: jest.fn(),
      findDomainHomepage: jest.fn(),
      findOneByDomainSlugAndPageSlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      previewEntityCollection: jest.fn(),
    } as unknown as PagesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should mark reads as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PagesController.prototype.findAll),
    ).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        PagesController.prototype.findGlobalHomepage,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        PagesController.prototype.findOneGlobalBySlug,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        PagesController.prototype.findAllByDomainSlug,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        PagesController.prototype.findDomainHomepage,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        PagesController.prototype.findOneByDomainSlugAndPageSlug,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PagesController.prototype.findOne),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PagesController.prototype.findMany),
    ).toBe(true);
  });

  it('should restrict writes to admin and editor', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, PagesController.prototype.create),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PagesController.prototype.update),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PagesController.prototype.remove),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PagesController.prototype.findAllGlobal),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PagesController.prototype.findAllAdmin),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        PagesController.prototype.findAllByDomainIdAdmin,
      ),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PagesController.prototype.findAdminOne),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PagesController.prototype.findManyAdmin),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        PagesController.prototype.previewEntityCollection,
      ),
    ).toEqual([Role.Admin, Role.Editor]);
  });

  it('should constrain id routes to object id regex', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, PagesController.prototype.findOne),
    ).toBe(':id([0-9a-fA-F]{24})');
    expect(
      Reflect.getMetadata(PATH_METADATA, PagesController.prototype.update),
    ).toBe(':id([0-9a-fA-F]{24})');
    expect(
      Reflect.getMetadata(PATH_METADATA, PagesController.prototype.remove),
    ).toBe(':id([0-9a-fA-F]{24})');
  });
});

describe('EntityCollection preview disconnect lifecycle', () => {
  function setup() {
    const request = Object.assign(new EventEmitter(), { aborted: false });
    const response = Object.assign(new EventEmitter(), {
      writableEnded: false,
      destroyed: false,
    });
    const preview = jest.fn(async (_body: unknown, signal?: AbortSignal) => {
      signal?.throwIfAborted();
      return { items: [] };
    });
    const controller = new PagesController({
      previewEntityCollection: preview,
    } as unknown as PagesService);
    const run = () =>
      controller.previewEntityCollection(
        {
          entityType: EntityCollectionEntityType.People,
          filters: {},
          contextDomainId: null,
        },
        request as unknown as Request,
        response as unknown as Response,
      );
    return { request, response, preview, run };
  }
  it.each(['aborted', 'close'])(
    'propagates %s and removes lifecycle listeners',
    async (event) => {
      const { request, response, preview, run } = setup();
      preview.mockImplementation(
        (_body, signal) =>
          new Promise((_resolve, reject) =>
            signal?.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            }),
          ),
      );
      const result = run();
      if (event === 'aborted') request.emit(event);
      else response.emit(event);
      await expect(result).resolves.toBeUndefined();
      expect(preview.mock.calls[0][1]?.aborted).toBe(true);
      expect(request.listenerCount('aborted')).toBe(0);
      expect(response.listenerCount('close')).toBe(0);
    },
  );
  it('ignores normal request completion and completed responses', async () => {
    const { request, response, preview, run } = setup();
    const result = run();
    request.emit('close');
    response.writableEnded = true;
    response.emit('close');
    await expect(result).resolves.toEqual({ items: [] });
    expect(preview.mock.calls[0][1]?.aborted).toBe(false);
    expect(request.listenerCount('aborted')).toBe(0);
    expect(response.listenerCount('close')).toBe(0);
  });
  it('cancels already disconnected clients before starting work', async () => {
    const { request, preview, run } = setup();
    request.aborted = true;
    await expect(run()).resolves.toBeUndefined();
    expect(preview.mock.calls[0][1]?.aborted).toBe(true);
  });
  it('preserves ordinary failures even if the client disconnects', async () => {
    const { request, response, preview, run } = setup();
    const failure = new Error('database');
    preview.mockRejectedValue(failure);
    const result = run();
    request.emit('aborted');
    await expect(result).rejects.toBe(failure);
    expect(response.listenerCount('close')).toBe(0);
  });
});
