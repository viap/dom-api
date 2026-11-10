import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { RolesGuard } from '@/roles/roles.guard';
import { ApplicationNotificationRoutesController } from './application-notification-routes.controller';

describe('ApplicationNotificationRoutesController', () => {
  const controller = new ApplicationNotificationRoutesController({} as never);

  it('allows Admins and Editors to read while keeping replacement Admin-only', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, ApplicationNotificationRoutesController),
    ).toEqual([Role.Admin, Role.Editor]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        ApplicationNotificationRoutesController.prototype.replace,
      ),
    ).toEqual([Role.Admin]);
  });

  it('allows Editor reads and rejects Editor writes through the global role contract', async () => {
    const guard = new RolesGuard(new Reflector());
    const contextFor = (
      handler:
        | ApplicationNotificationRoutesController['getAll']
        | ApplicationNotificationRoutesController['getEligibleUsers']
        | ApplicationNotificationRoutesController['replace'],
      roles: Array<Role>,
    ) =>
      ({
        getHandler: () => handler,
        getClass: () => ApplicationNotificationRoutesController,
        switchToHttp: () => ({
          getRequest: () => ({ userContext: { roles } }),
        }),
      } as never);

    await expect(
      guard.canActivate(contextFor(controller.getAll, [Role.Admin])),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(controller.getAll, [Role.Editor])),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(controller.getEligibleUsers, [Role.Admin])),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(controller.getEligibleUsers, [Role.Editor])),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(controller.replace, [Role.Admin])),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(controller.replace, [Role.Editor])),
    ).resolves.toBe(false);
  });
});
