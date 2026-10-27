import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model } from 'mongoose';
import { validateObjectId } from '@/common/utils/mongo-sanitizer';
import { Role } from '@/roles/enums/roles.enum';
import { valueToObjectId } from '@/common/utils/value-to-object-id';
import { UsersService } from '@/users/users.service';
import { NOTIFICATION_DAYS_LIFETIME } from './consts';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationStatuses } from './enums/notification-statuses.enum';
import { joiCreateNotificationSchema } from './schemas/joi.create-notification.schema';
import { joiUpdateNotificationSchema } from './schemas/joi.update-notification.schema';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

const submodels = [
  {
    path: 'recipients',
    model: 'User',
  },
  {
    path: 'received',
    model: 'User',
  },
];

function parseDateValue(value?: string | Date): Date | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// Upper bound for the bot's session user ids in one batch request.
const MAX_BOT_CANDIDATES = 5000;

type AudienceUser = { _id?: unknown; roles?: Array<Role> };
type AudienceNotification = Pick<
  Notification,
  'roles' | 'recipients' | 'received'
>;

const toId = (value: unknown): string =>
  String((value as { _id?: unknown })?._id ?? value);

// The single audience rule for notifications: no roles or one of the user's
// roles, and no recipients or the user among them. Used by the bot batch,
// per-user lists and receipts so they cannot drift apart.
export function isNotificationAudience(
  notification: AudienceNotification,
  user: AudienceUser,
): boolean {
  const userId = toId(user);
  const roleMatches =
    !notification.roles.length ||
    notification.roles.some((role) => user.roles?.includes(role));
  const recipientMatches =
    !notification.recipients.length ||
    notification.recipients.some((recipient) => toId(recipient) === userId);

  return roleMatches && recipientMatches;
}

function hasReceived(notification: AudienceNotification, userId: string) {
  return notification.received.some((item) => toId(item) === userId);
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private userService: UsersService,
  ) {}

  async getAll(): Promise<Array<NotificationDocument>> {
    return this.notificationModel.find().populate(submodels).exec();
  }

  async getById(id: string): Promise<NotificationDocument> {
    return this.notificationModel.findById(id).populate(submodels).exec();
  }

  async getAllActive(
    extraFilters: Array<FilterQuery<Notification>> = [],
    needPopulate = false,
  ): Promise<Array<NotificationDocument>> {
    return await this.notificationModel
      .find({
        $and: [
          ...extraFilters,
          {
            // NOTICE: only active notifications
            status: { $eq: NotificationStatuses.ACTIVE },
          },
          {
            // NOTICE: only events that have occurred
            startsAt: { $lte: new Date() },
          },
          {
            // NOTICE: only events that have not ended
            $or: [
              { finishAt: { $gte: new Date() } },
              { finishAt: { $exists: false } },
            ],
          },
        ],
      })
      .populate(needPopulate ? submodels : undefined)
      .exec();
  }

  async getAllByUserId(userId: string): Promise<Array<NotificationDocument>> {
    const user = await this.userService.getById(userId);
    if (!user) return [];

    const notifications = await this.getAllActive();
    return notifications.filter(
      (notification) =>
        isNotificationAudience(notification, user) &&
        !hasReceived(notification, toId(user)),
    );
  }

  // Active notifications for the bot. When the bot sends the user ids it has
  // sessions for, each notification lists which of them may still receive it,
  // judged by current database roles rather than the bot's stored tokens.
  async getAllActiveForBot(
    candidateUserIds?: unknown,
  ): Promise<Array<NotificationDocument | Record<string, unknown>>> {
    const notifications = await this.getAllActive();
    const ids = [
      ...new Set(
        (Array.isArray(candidateUserIds) ? candidateUserIds : [])
          .map((id) => validateObjectId(id))
          .filter((id): id is string => !!id),
      ),
    ].slice(0, MAX_BOT_CANDIDATES);
    const users = ids.length ? await this.userService.getRolesByIds(ids) : [];

    return notifications.map((notification) => ({
      ...notification.toObject(),
      eligibleUserIds: users
        .filter(
          (user) =>
            isNotificationAudience(notification, user) &&
            !hasReceived(notification, toId(user)),
        )
        .map((user) => toId(user)),
    }));
  }

  async create(
    createData: CreateNotificationDto,
  ): Promise<NotificationDocument | false> {
    const validationResult = joiCreateNotificationSchema.validate(createData);

    if (!validationResult.error) {
      const startsAt =
        parseDateValue(validationResult.value.startsAt) ?? new Date();
      const finishAt =
        parseDateValue(validationResult.value.finishAt) ??
        new Date(
          startsAt.getTime() + NOTIFICATION_DAYS_LIFETIME * 24 * 60 * 60 * 1000,
        );

      const newNotificationData = {
        ...validationResult.value,
        startsAt,
        // NOTICE: finishAt = startAt + NOTIFICATION_DAYS_LIFETIME, if not set another
        finishAt,
        recipients: validationResult.value.recipients
          ? validationResult.value.recipients.map(valueToObjectId)
          : undefined,
      };

      return await this.notificationModel.create(newNotificationData);
    }

    return false;
  }

  async update(
    id: string,
    updateData: UpdateNotificationDto,
  ): Promise<NotificationDocument | false> {
    const validationResult = joiUpdateNotificationSchema.validate(updateData);

    if (!validationResult.error) {
      const updatePayload = { ...validationResult.value };
      if (
        Object.prototype.hasOwnProperty.call(updatePayload, 'message') &&
        !Object.prototype.hasOwnProperty.call(updatePayload, 'messageEntities')
      ) {
        updatePayload.messageEntities = [];
      }

      const recipients: Array<mongoose.Types.ObjectId> | undefined =
        updatePayload.recipients
          ? updatePayload.recipients.map(valueToObjectId)
          : undefined;

      const received: Array<mongoose.Types.ObjectId> | undefined =
        updatePayload.received
          ? updatePayload.received.map(valueToObjectId)
          : undefined;

      return this.notificationModel
        .findByIdAndUpdate(id, { ...updatePayload, recipients, received })
        .exec();
    }

    return false;
  }

  async addReceived(notificationId: string, userId: string): Promise<boolean> {
    const validNotificationId = validateObjectId(notificationId);
    if (!validNotificationId) return false;

    const user = await this.userService.getById(userId);
    if (!user) return false;

    // NOTICE: the user must still be in the audience by current roles.
    const notification = await this.notificationModel
      .findById(validNotificationId)
      .exec();
    if (!notification || !isNotificationAudience(notification, user)) {
      return false;
    }

    // NOTICE: add user to received list; the filter makes the claim atomic.
    const updatedNotification = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: validNotificationId,
          received: {
            $not: { $elemMatch: { $eq: user._id } },
          },
        },
        {
          $addToSet: { received: user._id },
        },
      )
      .exec();

    if (!updatedNotification) {
      return false;
    }

    await this.updateNotificationStatus(validNotificationId);

    return true;
  }

  async updateNotificationStatus(notificationId: string) {
    const notification = await this.notificationModel.findById(notificationId);
    if (!notification) {
      return;
    }

    let isEveryoneWasNotified = false;
    const isTimeOver = notification.finishAt
      ? notification.finishAt < new Date()
      : false;

    if (!isTimeOver) {
      if (
        notification.recipients.length > 0 &&
        notification.recipients.length === notification.received.length
      ) {
        isEveryoneWasNotified =
          notification.recipients
            .sort()
            .map((item) => item.toString())
            .join() ===
          notification.received
            .sort()
            .map((item) => item.toString())
            .join();
      }
    }

    if (isEveryoneWasNotified || isTimeOver) {
      notification.status = NotificationStatuses.INACTIVE;
      await notification.save();
    }
  }

  async remove(id: string): Promise<boolean> {
    return !!(await this.notificationModel.findByIdAndRemove(id).exec());
  }
}
