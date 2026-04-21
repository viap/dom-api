import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

describe('PeopleController', () => {
  let controller: PeopleController;

  beforeEach(() => {
    controller = new PeopleController({
      findAll: jest.fn(),
      findAllAdmin: jest.fn(),
      findOneAdmin: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as PeopleService);
  });

  it('should mark public reads as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PeopleController.prototype.findAll),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PeopleController.prototype.findOne),
    ).toBe(true);
  });

  it('should restrict admin reads and writes to admin/editor', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, PeopleController.prototype.findAllAdmin),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PeopleController.prototype.findOneAdmin),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PeopleController.prototype.create),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PeopleController.prototype.update),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PeopleController.prototype.remove),
    ).toEqual([Role.Admin, Role.Editor]);
  });
});
