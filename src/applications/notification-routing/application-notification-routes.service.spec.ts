import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '@/roles/enums/roles.enum';
import { ApplicationFormType } from '../enums/application-form-type.enum';
import { ApplicationNotificationRoutesService } from './application-notification-routes.service';

describe('ApplicationNotificationRoutesService', () => {
  const adminId = new Types.ObjectId().toString();
  const editorId = new Types.ObjectId().toString();
  const secondEditorId = new Types.ObjectId().toString();
  const unlinkedEditorId = new Types.ObjectId().toString();
  const demotedId = new Types.ObjectId().toString();
  const missingId = new Types.ObjectId().toString();
  const users = [
    user(adminId, 'Admin', [Role.Admin], '100'),
    user(editorId, 'Editor', [Role.Editor], '101'),
    user(secondEditorId, 'Second Editor', [Role.Editor], '102'),
    user(unlinkedEditorId, 'Unlinked Editor', [Role.Editor]),
    user(demotedId, 'Demoted User', [Role.User]),
  ];

  let model: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let usersService: { getByRolesOrIds: jest.Mock; getAll: jest.Mock };
  let service: ApplicationNotificationRoutesService;

  beforeEach(() => {
    model = {
      find: jest.fn().mockReturnValue(query([])),
      findOne: jest.fn().mockReturnValue(query(null)),
      create: jest.fn(),
      findOneAndUpdate: jest.fn().mockReturnValue(query(null)),
    };
    usersService = {
      getByRolesOrIds: jest.fn().mockResolvedValue(users),
      getAll: jest.fn(),
    };
    service = new ApplicationNotificationRoutesService(
      model as never,
      usersService as never,
    );
  });

  it('returns every canonical type at revision zero from an empty collection', async () => {
    const result = await service.getAll();

    expect(result.map((route) => route.formType)).toEqual(
      Object.values(ApplicationFormType),
    );
    expect(usersService.getAll).not.toHaveBeenCalled();
    expect(usersService.getByRolesOrIds).toHaveBeenCalledWith(
      [Role.Admin, Role.Editor],
      [],
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          revision: 0,
          responsibleUsers: [],
          missingUserIds: [],
          fallbackActive: true,
          fallbackAvailable: true,
        }),
      ]),
    );
  });

  it('reports missing and demoted assignments while retaining role-eligible users', async () => {
    model.find.mockReturnValue(
      query([
        route(ApplicationFormType.General, 4, [
          editorId,
          secondEditorId,
          unlinkedEditorId,
          demotedId,
          missingId,
        ]),
      ]),
    );

    const result = await service.getAll();
    const general = result.find(
      (item) => item.formType === ApplicationFormType.General,
    );

    expect(general).toEqual({
      formType: ApplicationFormType.General,
      revision: 4,
      responsibleUsers: [
        expect.objectContaining({ id: editorId, eligible: true }),
        expect.objectContaining({
          id: secondEditorId,
          eligible: true,
        }),
        expect.objectContaining({
          id: unlinkedEditorId,
          telegramIdentityLinked: false,
          eligible: false,
          issue: 'telegram_identity_unlinked',
        }),
        expect.objectContaining({
          id: demotedId,
          eligible: false,
          issue: 'role_ineligible',
        }),
      ],
      missingUserIds: [missingId],
      fallbackActive: false,
      fallbackAvailable: true,
    });
    expect(usersService.getByRolesOrIds).toHaveBeenCalledWith(
      [Role.Admin, Role.Editor],
      [editorId, secondEditorId, unlinkedEditorId, demotedId, missingId],
    );
  });

  it('returns only Admin and Editor users with derived linkage metadata', async () => {
    const result = await service.getEligibleUsers();

    expect(result).toEqual([
      {
        id: adminId,
        name: 'Admin',
        roles: [Role.Admin],
        telegramIdentityLinked: true,
        assignable: true,
      },
      {
        id: editorId,
        name: 'Editor',
        roles: [Role.Editor],
        telegramIdentityLinked: true,
        assignable: true,
      },
      {
        id: secondEditorId,
        name: 'Second Editor',
        roles: [Role.Editor],
        telegramIdentityLinked: true,
        assignable: true,
      },
      {
        id: unlinkedEditorId,
        name: 'Unlinked Editor',
        roles: [Role.Editor],
        telegramIdentityLinked: false,
        assignable: false,
      },
    ]);
    result.forEach((candidate) =>
      expect(candidate).not.toHaveProperty('telegramId'),
    );
    expect(result.map((user) => user.id)).not.toContain(demotedId);
  });

  it('filters missing, demoted, and unlinked configured users', async () => {
    model.findOne.mockReturnValue(
      query(
        route(ApplicationFormType.General, 9, [
          editorId,
          secondEditorId,
          unlinkedEditorId,
          demotedId,
          missingId,
        ]),
      ),
    );

    await expect(
      service.resolveAudience(ApplicationFormType.General),
    ).resolves.toEqual({
      mode: 'configured',
      roles: [Role.Admin, Role.Editor],
      recipientIds: [editorId, secondEditorId],
      routeRevision: 9,
    });
  });

  it.each([
    ['route_missing', null],
    ['route_empty', route(ApplicationFormType.General, 2, [])],
    [
      'route_has_no_effective_users',
      route(ApplicationFormType.General, 3, [demotedId, missingId]),
    ],
  ])('uses Admin fallback for %s', async (reason, storedRoute) => {
    model.findOne.mockReturnValue(query(storedRoute));

    await expect(
      service.resolveAudience(ApplicationFormType.General),
    ).resolves.toEqual({
      mode: 'admin_fallback',
      roles: [Role.Admin],
      recipientIds: [adminId],
      reason,
    });
  });

  it('uses only linked Admins for fallback', async () => {
    const linkedAdminId = new Types.ObjectId().toString();
    usersService.getByRolesOrIds.mockResolvedValue([
      user(editorId, 'Editor', [Role.Editor], '101'),
      user(adminId, 'Admin', [Role.Admin]),
      user(linkedAdminId, 'Linked Admin', [Role.Admin], '103'),
    ]);

    await expect(
      service.resolveAudience(ApplicationFormType.General),
    ).resolves.toEqual({
      mode: 'admin_fallback',
      roles: [Role.Admin],
      recipientIds: [linkedAdminId],
      reason: 'route_missing',
    });
  });

  it('returns unavailable instead of an empty fallback when no linked Admin exists', async () => {
    usersService.getByRolesOrIds.mockResolvedValue([
      user(editorId, 'Editor', [Role.Editor], '101'),
      user(adminId, 'Admin', [Role.Admin]),
      user(demotedId, 'User', [Role.User]),
    ]);

    await expect(
      service.resolveAudience(ApplicationFormType.General),
    ).resolves.toEqual({
      mode: 'unavailable',
      reason: 'no_linked_admin_fallback',
    });
  });

  it('creates the first route at revision one', async () => {
    model.create.mockResolvedValue(
      route(ApplicationFormType.General, 1, [editorId]),
    );

    const result = await service.replace(ApplicationFormType.General, {
      expectedRevision: 0,
      responsibleUserIds: [editorId],
    });

    expect(model.create).toHaveBeenCalledWith({
      formType: ApplicationFormType.General,
      responsibleUsers: [editorId],
      revision: 1,
    });
    expect(result.revision).toBe(1);
  });

  it('increments an existing route exactly once with a conditional update', async () => {
    model.findOneAndUpdate.mockReturnValue(
      query(route(ApplicationFormType.General, 3, [adminId, editorId])),
    );

    const result = await service.replace(ApplicationFormType.General, {
      expectedRevision: 2,
      responsibleUserIds: [adminId, editorId],
    });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { formType: ApplicationFormType.General, revision: 2 },
      {
        $set: { responsibleUsers: [adminId, editorId] },
        $inc: { revision: 1 },
      },
      { new: true },
    );
    expect(result.revision).toBe(3);
  });

  it('returns the committed current DTO for stale or lost-response retries', async () => {
    const current = route(ApplicationFormType.General, 1, [editorId]);
    model.findOne.mockReturnValue(query(current));

    await expect(
      service.replace(ApplicationFormType.General, {
        expectedRevision: 0,
        responsibleUserIds: [editorId],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 409,
        code: 'application_notification_route_conflict',
        message: 'The route changed since this version was loaded.',
        current: expect.objectContaining({ revision: 1 }),
      }),
    });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('converts a competing first-write duplicate key into a conflict', async () => {
    model.findOne
      .mockReturnValueOnce(query(null))
      .mockReturnValueOnce(
        query(route(ApplicationFormType.General, 1, [adminId])),
      );
    model.create.mockRejectedValue({ code: 11000 });

    await expect(
      service.replace(ApplicationFormType.General, {
        expectedRevision: 0,
        responsibleUserIds: [editorId],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ['malformed', ['not-an-object-id']],
    ['duplicate', [adminId, adminId]],
    ['missing', [missingId]],
    ['demoted', [demotedId]],
    ['unlinked', [unlinkedEditorId]],
  ])('rejects %s responsible users', async (_label, ids) => {
    await expect(
      service.replace(ApplicationFormType.General, {
        expectedRevision: 0,
        responsibleUserIds: ids,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports fallback unavailable when no linked Admin exists', async () => {
    usersService.getByRolesOrIds.mockResolvedValue([
      user(editorId, 'Editor', [Role.Editor], '101'),
      user(adminId, 'Admin', [Role.Admin]),
    ]);

    const [routeDto] = await service.getAll();

    expect(routeDto.fallbackAvailable).toBe(false);
  });

  it('rejects unknown application types without creating a document', async () => {
    await expect(
      service.replace('unknown' as ApplicationFormType, {
        expectedRevision: 0,
        responsibleUserIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });
});

function query<T>(value: T): { exec: () => Promise<T> } {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function user(
  id: string,
  name: string,
  roles: Array<Role>,
  telegramId?: string,
) {
  return { _id: new Types.ObjectId(id), name, roles, telegramId } as never;
}

function route(
  formType: ApplicationFormType,
  revision: number,
  responsibleUsers: Array<string>,
) {
  return {
    formType,
    revision,
    responsibleUsers: responsibleUsers.map((id) => new Types.ObjectId(id)),
  } as never;
}
