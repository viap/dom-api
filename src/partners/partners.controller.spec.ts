import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

describe('PartnersController', () => {
  let controller: PartnersController;

  beforeEach(() => {
    controller = new PartnersController({
      findAll: jest.fn(),
      findOne: jest.fn(),
      findAllAdmin: jest.fn(),
      findOneAdmin: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as PartnersService);
  });

  it('should mark public reads as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PartnersController.prototype.findAll),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, PartnersController.prototype.findOne),
    ).toBe(true);
  });

  it('should restrict admin reads and writes to admin/editor', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, PartnersController.prototype.findAllAdmin),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PartnersController.prototype.findOneAdmin),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PartnersController.prototype.create),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PartnersController.prototype.update),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PartnersController.prototype.remove),
    ).toEqual([Role.Admin, Role.Editor]);
  });
});
