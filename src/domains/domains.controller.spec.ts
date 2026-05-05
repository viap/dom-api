import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';

describe('DomainsController', () => {
  let controller: DomainsController;

  beforeEach(() => {
    controller = new DomainsController({
      findAll: jest.fn(),
      findOne: jest.fn(),
      findManyByIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as DomainsService);
  });

  it('should mark public reads as public', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, DomainsController.prototype.findAll),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, DomainsController.prototype.findOne),
    ).toBe(true);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, DomainsController.prototype.findMany),
    ).toBe(true);
  });

  it('should restrict writes to admin', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, DomainsController.prototype.create),
    ).toEqual([Role.Admin]);
    expect(
      Reflect.getMetadata(ROLES_KEY, DomainsController.prototype.update),
    ).toEqual([Role.Admin]);
    expect(
      Reflect.getMetadata(ROLES_KEY, DomainsController.prototype.remove),
    ).toEqual([Role.Admin]);
  });
});
