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
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as EventsService);
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
