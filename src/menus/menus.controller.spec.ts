import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';

describe('MenusController', () => {
  let controller: MenusController;

  beforeEach(() => {
    controller = new MenusController({
      findAll: jest.fn(),
      findOne: jest.fn(),
      findPublicGlobalByKey: jest.fn(),
      findPublicByDomainAndKey: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as MenusService);
  });

  it('should mark public reads as public', () => {
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        MenusController.prototype.findPublicGlobalByKey,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        MenusController.prototype.findPublicByDomainAndKey,
      ),
    ).toBe(true);
  });

  it('should restrict admin routes to admin and editor', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, MenusController.prototype.findAll),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, MenusController.prototype.findOne),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, MenusController.prototype.create),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, MenusController.prototype.update),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, MenusController.prototype.remove),
    ).toEqual([Role.Admin, Role.Editor]);
  });
});
