import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { applicationNotificationRouteSchema } from './application-notification-route.schema';
import { updateApplicationNotificationRouteSchema } from './joi.update-application-notification-route.schema';

describe('application notification route schemas', () => {
  it('defines one unique route per form type and revision constraints', () => {
    expect(applicationNotificationRouteSchema.indexes()).toContainEqual([
      { formType: 1 },
      { unique: true, background: true },
    ]);
    expect(applicationNotificationRouteSchema.path('revision').options).toEqual(
      expect.objectContaining({ required: true, min: 1, default: 1 }),
    );
    expect(
      applicationNotificationRouteSchema.path('responsibleUsers').options,
    ).toEqual(expect.objectContaining({ required: true, default: [] }));
  });

  it('accepts empty replacement and valid revisions', () => {
    const result = updateApplicationNotificationRouteSchema.validate({
      expectedRevision: 0,
      responsibleUserIds: [],
    });

    expect(result.error).toBeUndefined();
  });

  it.each([
    { expectedRevision: -1, responsibleUserIds: [] },
    { expectedRevision: 1.5, responsibleUserIds: [] },
    { expectedRevision: 0, responsibleUserIds: ['bad'] },
    {
      expectedRevision: 0,
      responsibleUserIds: [
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439011',
      ],
    },
    { expectedRevision: 0 },
  ])('rejects an invalid replacement body %#', (body) => {
    expect(
      updateApplicationNotificationRouteSchema.validate(body).error,
    ).toBeDefined();
  });

  it('keeps canonical application types as the schema enum source', () => {
    expect(
      applicationNotificationRouteSchema.path('formType').options.enum,
    ).toEqual(Object.values(ApplicationFormType));
  });
});
