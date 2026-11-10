import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { RolesGuard } from '@/roles/roles.guard';
import { ApplicationNotificationRoutesController } from './application-notification-routes.controller';

describe('ApplicationNotificationRoutesController', () => {
  const controller = new ApplicationNotificationRoutesController({} as never);

  it('requires the Admin role for every endpoint', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, ApplicationNotificationRoutesController),
    ).toEqual([Role.Admin]);
  });

  it('allows an Admin and rejects an Editor through the global role contract', async () => {
    const guard = new RolesGuard(new Reflector());
    const contextFor = (roles: Array<Role>) =>
      ({
        getHandler: () => controller.getAll,
        getClass: () => ApplicationNotificationRoutesController,
        switchToHttp: () => ({
          getRequest: () => ({ userContext: { roles } }),
        }),
      } as never);

    await expect(guard.canActivate(contextFor([Role.Admin]))).resolves.toBe(
      true,
    );
    await expect(guard.canActivate(contextFor([Role.Editor]))).resolves.toBe(
      false,
    );
  });
});
