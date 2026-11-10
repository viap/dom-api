import { ConflictException } from '@nestjs/common';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { Role } from '@/roles/enums/roles.enum';
import { ApplicationFormType } from '../enums/application-form-type.enum';
import { ApplicationNotificationRoutesService } from './application-notification-routes.service';
import {
  ApplicationNotificationRoute,
  applicationNotificationRouteSchema,
} from './schemas/application-notification-route.schema';

const mongoUri = process.env.MONGODB_ROUTING_TEST_URI;
const describeWithMongo = mongoUri ? describe : describe.skip;

describeWithMongo(
  'ApplicationNotificationRoutesService real MongoDB races',
  () => {
    const adminId = new Types.ObjectId().toString();
    const editorId = new Types.ObjectId().toString();
    const users = [
      user(adminId, 'Admin', [Role.Admin], '100'),
      user(editorId, 'Editor', [Role.Editor], '101'),
    ];
    let connection: Connection;
    let model: Model<ApplicationNotificationRoute>;
    let service: ApplicationNotificationRoutesService;

    beforeAll(async () => {
      connection = await mongoose.createConnection(mongoUri).asPromise();
      model = connection.model(
        ApplicationNotificationRoute.name,
        applicationNotificationRouteSchema,
      );
      await model.syncIndexes();
      service = new ApplicationNotificationRoutesService(
        model as never,
        { getByRolesOrIds: async () => users } as never,
      );
    });

    beforeEach(async () => {
      await model.deleteMany({});
    });

    afterAll(async () => {
      if (connection) {
        await connection.dropDatabase();
        await connection.close();
      }
    });

    it('allows one competing first write, preserves the exact winner, and creates no duplicate', async () => {
      const results = await Promise.allSettled([
        service.replace(ApplicationFormType.General, {
          expectedRevision: 0,
          responsibleUserIds: [adminId],
        }),
        service.replace(ApplicationFormType.General, {
          expectedRevision: 0,
          responsibleUserIds: [editorId],
        }),
      ]);

      assertOneWinnerOneConflict(results);
      const winner = results.find(
        (
          result,
        ): result is PromiseFulfilledResult<
          Awaited<ReturnType<typeof service.replace>>
        > => result.status === 'fulfilled',
      ).value;
      const stored = await model.findOne({
        formType: ApplicationFormType.General,
      });

      expect(
        await model.countDocuments({ formType: ApplicationFormType.General }),
      ).toBe(1);
      expect(stored.revision).toBe(1);
      expect(stored.responsibleUsers.map(String)).toEqual(
        winner.responsibleUsers.map((user) => user.id),
      );
    });

    it('allows one update from a shared revision and increments only once', async () => {
      await service.replace(ApplicationFormType.General, {
        expectedRevision: 0,
        responsibleUserIds: [adminId],
      });

      const results = await Promise.allSettled([
        service.replace(ApplicationFormType.General, {
          expectedRevision: 1,
          responsibleUserIds: [editorId],
        }),
        service.replace(ApplicationFormType.General, {
          expectedRevision: 1,
          responsibleUserIds: [adminId, editorId],
        }),
      ]);

      assertOneWinnerOneConflict(results);
      const winner = results.find(
        (
          result,
        ): result is PromiseFulfilledResult<
          Awaited<ReturnType<typeof service.replace>>
        > => result.status === 'fulfilled',
      ).value;
      const stored = await model.findOne({
        formType: ApplicationFormType.General,
      });

      expect(
        await model.countDocuments({ formType: ApplicationFormType.General }),
      ).toBe(1);
      expect(stored.revision).toBe(2);
      expect(stored.responsibleUsers.map(String)).toEqual(
        winner.responsibleUsers.map((user) => user.id),
      );
    });

    it('treats a retry after a discarded success response as conflict without a second increment', async () => {
      await service.replace(ApplicationFormType.General, {
        expectedRevision: 0,
        responsibleUserIds: [editorId],
      });

      await expect(
        service.replace(ApplicationFormType.General, {
          expectedRevision: 0,
          responsibleUserIds: [editorId],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'application_notification_route_conflict',
          current: expect.objectContaining({ revision: 1 }),
        }),
      });

      const stored = await model.findOne({
        formType: ApplicationFormType.General,
      });
      expect(stored.revision).toBe(1);
      expect(stored.responsibleUsers.map(String)).toEqual([editorId]);
    });
  },
);

function assertOneWinnerOneConflict(
  results: Array<PromiseSettledResult<unknown>>,
): void {
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  expect(rejected.reason).toBeInstanceOf(ConflictException);
}

function user(
  id: string,
  name: string,
  roles: Array<Role>,
  telegramId: string,
) {
  return { _id: new Types.ObjectId(id), name, roles, telegramId } as never;
}
