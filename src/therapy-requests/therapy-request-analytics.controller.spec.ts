import 'reflect-metadata';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { TherapyRequestAnalyticsController } from './therapy-request-analytics.controller';

describe('TherapyRequestAnalyticsController', () => {
  const analyticsRoles = [Role.Admin, Role.Editor];

  it('allows admin and editor access to analytics routes', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, TherapyRequestAnalyticsController),
    ).toEqual(analyticsRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getFilters,
      ),
    ).toEqual(analyticsRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getSummary,
      ),
    ).toEqual(analyticsRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getRequests,
      ),
    ).toEqual(analyticsRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getRequestDetails,
      ),
    ).toEqual(analyticsRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getLifecycle,
      ),
    ).toEqual(analyticsRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.export,
      ),
    ).toEqual(analyticsRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.updateRequestAnalytics,
      ),
    ).toEqual(analyticsRoles);
  });
});
