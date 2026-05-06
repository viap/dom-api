import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';

describe('ProgramsController', () => {
  let controller: ProgramsController;

  beforeEach(() => {
    controller = new ProgramsController({
      findAll: jest.fn(),
      findOne: jest.fn(),
      findManyByIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as ProgramsService);
  });

  it('should mark public reads as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, ProgramsController.prototype.findAll),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, ProgramsController.prototype.findOne),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, ProgramsController.prototype.findMany),
    ).toBe(true);
  });

  it('should restrict writes to admin/editor', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, ProgramsController.prototype.create),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, ProgramsController.prototype.update),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, ProgramsController.prototype.remove),
    ).toEqual([Role.Admin, Role.Editor]);
  });
});
