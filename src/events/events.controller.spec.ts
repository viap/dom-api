import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(() => {
    controller = new EventsController({
      findAll: jest.fn(),
      findOne: jest.fn(),
      findOneByDomainSlugAndEventSlug: jest.fn(),
      findManyByIds: jest.fn(),
      findManyAdminByIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as EventsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should mark public reads as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, EventsController.prototype.findAll),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, EventsController.prototype.findOne),
    ).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        EventsController.prototype.findOneByDomainSlugAndEventSlug,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, EventsController.prototype.findMany),
    ).toBe(true);
  });

  it('should restrict writes to admin/editor', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, EventsController.prototype.findManyAdmin),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, EventsController.prototype.create),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, EventsController.prototype.update),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, EventsController.prototype.remove),
    ).toEqual([Role.Admin, Role.Editor]);
  });
});

describe('EventsController public read disconnect lifecycle', () => {
  it('passes response disconnect cancellation into public event conversion', async () => {
    const request = Object.assign(new EventEmitter(), { aborted: false });
    const response = Object.assign(new EventEmitter(), {
      writableEnded: false,
      destroyed: false,
    });
    const findOne = jest.fn(
      (_id: string, signal?: AbortSignal) =>
        new Promise((_resolve, reject) =>
          signal?.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          }),
        ),
    );
    const controller = new EventsController({
      findOne,
    } as unknown as EventsService);

    const result = controller.findOne(
      '507f1f77bcf86cd799439011',
      request as unknown as Request,
      response as unknown as Response,
    );
    response.emit('close');

    await expect(result).resolves.toBeUndefined();
    expect(findOne.mock.calls[0][1]?.aborted).toBe(true);
    expect(request.listenerCount('aborted')).toBe(0);
    expect(response.listenerCount('close')).toBe(0);
  });
});
