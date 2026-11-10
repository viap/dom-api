import { validateObjectId } from '@/common/utils/mongo-sanitizer';
import { Role } from '@/roles/enums/roles.enum';
import {
  UserRoleIdentityProjection,
  UsersService,
} from '@/users/users.service';
import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApplicationFormType } from '../enums/application-form-type.enum';
import {
  ApplicationNotificationEligibleUserDto,
  ApplicationNotificationRouteDto,
  ApplicationNotificationRouteUserDto,
  UpdateApplicationNotificationRouteDto,
} from './dto/application-notification-route.dto';
import {
  ApplicationNotificationRoute,
  ApplicationNotificationRouteDocument,
} from './schemas/application-notification-route.schema';

type MongoDuplicateKeyError = { code?: number };
const ROUTING_ROLES = [Role.Admin, Role.Editor];

export type ApplicationNotificationAudience =
  | {
      mode: 'configured';
      roles: [Role.Admin, Role.Editor];
      recipientIds: Array<string>;
      routeRevision: number;
    }
  | {
      mode: 'admin_fallback';
      roles: [Role.Admin];
      recipientIds: Array<string>;
      reason: 'route_missing' | 'route_empty' | 'route_has_no_effective_users';
    }
  | {
      mode: 'unavailable';
      reason: 'no_linked_admin_fallback';
    };

@Injectable()
export class ApplicationNotificationRoutesService {
  constructor(
    @InjectModel(ApplicationNotificationRoute.name)
    private readonly routeModel: Model<ApplicationNotificationRoute>,
    private readonly usersService: UsersService,
  ) {}

  async getAll(): Promise<Array<ApplicationNotificationRouteDto>> {
    const routes = await this.routeModel.find().exec();
    const storedUserIds = routes.flatMap((route) =>
      route.responsibleUsers.map((id) => id.toString()),
    );
    const users = await this.usersService.getByRolesOrIds(
      ROUTING_ROLES,
      storedUserIds,
    );
    const routesByType = new Map(
      routes.map((route) => [route.formType, route] as const),
    );

    return Object.values(ApplicationFormType).map((formType) =>
      this.toRouteDto(formType, routesByType.get(formType), users),
    );
  }

  async getEligibleUsers(): Promise<
    Array<ApplicationNotificationEligibleUserDto>
  > {
    const users = await this.usersService.getByRolesOrIds(ROUTING_ROLES);

    return users
      .filter((user) => this.hasEligibleRole(user))
      .map((user) => ({
        id: user._id.toString(),
        name: user.name,
        roles: user.roles,
        telegramIdentityLinked: this.hasTelegramIdentity(user),
        assignable: this.hasTelegramIdentity(user),
      }));
  }

  async resolveAudience(
    formType: ApplicationFormType,
  ): Promise<ApplicationNotificationAudience> {
    this.assertSupportedFormType(formType);
    const route = await this.routeModel.findOne({ formType }).exec();
    const users = await this.usersService.getByRolesOrIds(
      ROUTING_ROLES,
      (route?.responsibleUsers || []).map((id) => id.toString()),
    );
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));
    const recipientIds = [
      ...new Set(
        (route?.responsibleUsers || [])
          .map((id) => id.toString())
          .filter((id) => {
            const user = usersById.get(id);
            return (
              user &&
              this.hasEligibleRole(user) &&
              this.hasTelegramIdentity(user)
            );
          }),
      ),
    ];

    if (route && recipientIds.length > 0) {
      return {
        mode: 'configured',
        roles: [Role.Admin, Role.Editor],
        recipientIds,
        routeRevision: route.revision,
      };
    }

    const fallbackIds = [
      ...new Set(
        users
          .filter(
            (user) =>
              user.roles.includes(Role.Admin) && this.hasTelegramIdentity(user),
          )
          .map((user) => user._id.toString()),
      ),
    ];
    if (fallbackIds.length === 0) {
      return { mode: 'unavailable', reason: 'no_linked_admin_fallback' };
    }

    return {
      mode: 'admin_fallback',
      roles: [Role.Admin],
      recipientIds: fallbackIds,
      reason: !route
        ? 'route_missing'
        : route.responsibleUsers.length === 0
        ? 'route_empty'
        : 'route_has_no_effective_users',
    };
  }

  async replace(
    formType: ApplicationFormType,
    update: UpdateApplicationNotificationRouteDto,
  ): Promise<ApplicationNotificationRouteDto> {
    this.assertSupportedFormType(formType);
    const responsibleUserIds = this.validateResponsibleUserIds(
      update.responsibleUserIds,
    );
    const users = await this.usersService.getByRolesOrIds(
      ROUTING_ROLES,
      responsibleUserIds,
    );
    this.assertAssignableUsers(responsibleUserIds, users);

    let route: ApplicationNotificationRouteDocument;
    if (update.expectedRevision === 0) {
      const current = await this.routeModel.findOne({ formType }).exec();
      if (current) {
        throw await this.createConflict(formType);
      }

      try {
        route = await this.routeModel.create({
          formType,
          responsibleUsers: responsibleUserIds,
          revision: 1,
        });
      } catch (error) {
        if (this.isDuplicateKeyError(error)) {
          throw await this.createConflict(formType);
        }
        throw error;
      }
    } else {
      route = await this.routeModel
        .findOneAndUpdate(
          { formType, revision: update.expectedRevision },
          {
            $set: { responsibleUsers: responsibleUserIds },
            $inc: { revision: 1 },
          },
          { new: true },
        )
        .exec();

      if (!route) {
        throw await this.createConflict(formType);
      }
    }

    return this.toRouteDto(formType, route, users);
  }

  private assertSupportedFormType(formType: ApplicationFormType): void {
    if (!Object.values(ApplicationFormType).includes(formType)) {
      throw new BadRequestException('Unsupported application form type');
    }
  }

  private validateResponsibleUserIds(ids: Array<string>): Array<string> {
    if (!Array.isArray(ids) || ids.length > 50) {
      throw new BadRequestException('Invalid responsible users');
    }

    const validated = ids.map((id) => validateObjectId(id));
    if (validated.some((id) => !id)) {
      throw new BadRequestException('Invalid responsible user id');
    }
    if (new Set(validated).size !== validated.length) {
      throw new BadRequestException('Duplicate responsible user id');
    }

    return validated as Array<string>;
  }

  private assertAssignableUsers(
    ids: Array<string>,
    users: Array<UserRoleIdentityProjection>,
  ): void {
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    for (const id of ids) {
      const user = usersById.get(id);
      if (!user) {
        throw new BadRequestException('Responsible user does not exist');
      }
      if (!this.hasEligibleRole(user)) {
        throw new BadRequestException(
          'Responsible user must be an Admin or Editor',
        );
      }
      if (!this.hasTelegramIdentity(user)) {
        throw new BadRequestException(
          'Responsible user must have a linked Telegram identity',
        );
      }
    }
  }

  private async createConflict(
    formType: ApplicationFormType,
  ): Promise<ConflictException> {
    const route = await this.routeModel.findOne({ formType }).exec();
    const users = await this.usersService.getByRolesOrIds(
      ROUTING_ROLES,
      (route?.responsibleUsers || []).map((id) => id.toString()),
    );
    const current = this.toRouteDto(formType, route, users);

    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      code: 'application_notification_route_conflict',
      message: 'The route changed since this version was loaded.',
      current,
    });
  }

  private toRouteDto(
    formType: ApplicationFormType,
    route: ApplicationNotificationRouteDocument | undefined | null,
    users: Array<UserRoleIdentityProjection>,
  ): ApplicationNotificationRouteDto {
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));
    const responsibleUsers: Array<ApplicationNotificationRouteUserDto> = [];
    const missingUserIds: Array<string> = [];

    for (const storedId of route?.responsibleUsers || []) {
      const id = storedId.toString();
      const user = usersById.get(id);
      if (!user) {
        missingUserIds.push(id);
        continue;
      }

      const roleEligible = this.hasEligibleRole(user);
      const telegramIdentityLinked = this.hasTelegramIdentity(user);
      const eligible = roleEligible && telegramIdentityLinked;
      responsibleUsers.push({
        id,
        name: user.name,
        roles: user.roles,
        telegramIdentityLinked,
        eligible,
        ...(!roleEligible
          ? { issue: 'role_ineligible' as const }
          : !telegramIdentityLinked
          ? { issue: 'telegram_identity_unlinked' as const }
          : {}),
      });
    }

    const fallbackAvailable = users.some(
      (user) =>
        user.roles.includes(Role.Admin) && this.hasTelegramIdentity(user),
    );
    const fallbackActive = !responsibleUsers.some((user) => user.eligible);

    return {
      formType,
      revision: route?.revision || 0,
      responsibleUsers,
      missingUserIds,
      fallbackActive,
      fallbackAvailable,
    };
  }

  private hasEligibleRole(user: UserRoleIdentityProjection): boolean {
    return user.roles.some((role) => [Role.Admin, Role.Editor].includes(role));
  }

  private hasTelegramIdentity(user: UserRoleIdentityProjection): boolean {
    return (
      typeof user.telegramId === 'string' && user.telegramId.trim().length > 0
    );
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      Boolean(error) &&
      typeof error === 'object' &&
      (error as MongoDuplicateKeyError).code === 11000
    );
  }
}
