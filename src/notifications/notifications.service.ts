import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model } from 'mongoose';
import { valueToObjectId } from 'src/common/utils/value-to-object-id';
import { UsersService } from 'src/users/users.service';
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

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    private userService: UsersService,
  ) {}

  async getAll(): Promise<Array<NotificationDocument>> {
    return this.notificationModel.find().populate(submodels).exec();
  }

  async getById(id: string): Promise<NotificationDocument> {
    return this.notificationModel.findById(id).populate(submodels).exec();
  }

  async getAllActive(
    extraFilters: Array<FilterQuery<any>> = [],
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
            startsAt: { $lte: Date.now() },
          },
          {
            // NOTICE: only events that have not ended
            $or: [
              { finishAt: { $gte: Date.now() } },
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

    const filters: Array<FilterQuery<any>> = [
      {
        // NOTICE: roles empty or user have any required role
        $or: [
          { roles: { $size: 0 } },
          { roles: { $elemMatch: { $in: user.roles } } },
        ],
      },
      {
        // NOTICE: recipients empty or user is in recipients list
        $or: [
          { recipients: { $size: 0 } },
          { recipients: { $elemMatch: { $eq: user._id } } },
        ],
      },
      {
        // NOTICE: user is not in received list
        received: { $not: { $elemMatch: { $eq: user._id } } },
      },
    ];

    return await this.getAllActive(filters);
  }

  async create(
    createData: CreateNotificationDto,
  ): Promise<NotificationDocument | false> {
    const validationResult = joiCreateNotificationSchema.validate(createData);
    if (!validationResult.error) {
      createData.startsAt = createData.startsAt || Date.now();
      // NOTICE: finishAt = startAt + one day, if not set another
      createData.finishAt =
        createData.finishAt ||
        new Date().setDate(new Date(createData.startsAt).getDate() + 1);

      const recipients: Array<mongoose.Types.ObjectId> | undefined =
        createData.recipients
          ? createData.recipients.map(valueToObjectId)
          : undefined;

      return await this.notificationModel.create({ ...createData, recipients });
    }

    return false;
  }

  async update(
    id: string,
    updateData: UpdateNotificationDto,
  ): Promise<NotificationDocument | false> {
    const validationResult = joiUpdateNotificationSchema.validate(updateData);

    if (!validationResult.error) {
      const recipients: Array<mongoose.Types.ObjectId> | undefined =
        updateData.recipients
          ? updateData.recipients.map(valueToObjectId)
          : undefined;

      const received: Array<mongoose.Types.ObjectId> | undefined =
        updateData.received
          ? updateData.received.map(valueToObjectId)
          : undefined;

      return this.notificationModel
        .findByIdAndUpdate(id, { ...updateData, recipients, received })
        .exec();
    }

    return false;
  }

  async addReceived(notificationId: string, userId: string): Promise<boolean> {
    const user = await this.userService.getById(userId);
    if (!user) return false;

    // NOTICE: add user to received list in notification
    await this.notificationModel
      .findOneAndUpdate(
        {
          _id: notificationId,
          received: {
            $not: { $elemMatch: { $eq: user._id } },
          },
        },
        {
          $addToSet: { received: user._id },
        },
      )
      .exec();

    await this.updateNotificationStatus(notificationId);

    // NOTICE: check if user was added to received list in notification
    return (
      (await this.notificationModel
        .findOne({
          _id: notificationId,
          received: {
            $elemMatch: { $eq: user._id },
          },
        })
        .count()) === 1
    );
  }

  async updateNotificationStatus(notificationId: string) {
    const notification = await this.notificationModel.findById(notificationId);

    let isEveryoneWasNotified = false;
    const isTimeOver = notification.finishAt < Date.now();

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
      notification.save();
    }
  }

  async remove(id: string): Promise<boolean> {
    return !!(await this.notificationModel.findByIdAndRemove(id).exec());
  }
}
