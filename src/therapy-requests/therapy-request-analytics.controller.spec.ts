import 'reflect-metadata';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { TherapyRequestAnalyticsController } from './therapy-request-analytics.controller';

describe('TherapyRequestAnalyticsController', () => {
  const readRoles = [Role.Admin, Role.Accountant];
  const reviewRoles = [Role.Admin];

  it('allows admin and accountant access to analytics read and export routes', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, TherapyRequestAnalyticsController),
    ).toEqual(readRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getFilters,
      ),
    ).toEqual(readRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getSummary,
      ),
    ).toEqual(readRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getRequests,
      ),
    ).toEqual(readRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getLifecycle,
      ),
    ).toEqual(readRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.export,
      ),
    ).toEqual(readRoles);
  });

  it('restricts analytics review context and updates to admins', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.getRequestDetails,
      ),
    ).toEqual(reviewRoles);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TherapyRequestAnalyticsController.prototype.updateRequestAnalytics,
      ),
    ).toEqual(reviewRoles);
  });
});
