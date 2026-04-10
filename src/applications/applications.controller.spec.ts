import 'reflect-metadata';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;

  beforeEach(() => {
    controller = new ApplicationsController({
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as ApplicationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should mark create as public and throttled', () => {
    const createMethod = ApplicationsController.prototype.create;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, createMethod)).toBe(true);
    expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, createMethod)).toBe(
      5,
    );
    expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, createMethod)).toBe(
      60000,
    );
  });
});
