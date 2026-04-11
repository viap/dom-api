import 'reflect-metadata';
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
      findAllGlobal: jest.fn(),
      findAdminOne: jest.fn(),
      findAllByDomainSlug: jest.fn(),
      findOne: jest.fn(),
      findOneGlobalBySlug: jest.fn(),
      findOneByDomainSlugAndPageSlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as PagesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should mark reads as public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PagesController.prototype.findAll)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PagesController.prototype.findOneGlobalBySlug)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PagesController.prototype.findAllByDomainSlug)).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        PagesController.prototype.findOneByDomainSlugAndPageSlug,
      ),
    ).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PagesController.prototype.findOne)).toBe(true);
  });

  it('should restrict writes to admin and editor', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PagesController.prototype.create)).toEqual([
      Role.Admin,
      Role.Editor,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, PagesController.prototype.update)).toEqual([
      Role.Admin,
      Role.Editor,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, PagesController.prototype.remove)).toEqual([
      Role.Admin,
      Role.Editor,
    ]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PagesController.prototype.findAllGlobal),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(ROLES_KEY, PagesController.prototype.findAdminOne),
    ).toEqual([Role.Admin, Role.Editor]);
  });
});
