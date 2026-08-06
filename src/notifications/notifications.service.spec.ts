import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { NotificationTypes } from './enums/notification-types.enum';
import { NotificationsService } from './notifications.service';
import { Notification } from './schemas/notification.schema';
import { joiCreateNotificationSchema } from './schemas/joi.create-notification.schema';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockNotificationModel: {
    find: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOne: jest.Mock;
    findByIdAndRemove: jest.Mock;
  };
  let mockUsersService: {
    getById: jest.Mock;
  };

  beforeEach(async () => {
    mockNotificationModel = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOne: jest.fn(),
      findByIdAndRemove: jest.fn(),
    };

    mockUsersService = {
      getById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(Notification.name),
          useValue: mockNotificationModel,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('message entity validation', () => {
    it('accepts valid notification message entities', () => {
      const result = joiCreateNotificationSchema.validate({
        type: NotificationTypes.MESSAGE,
        message: 'Text link',
        messageEntities: [
          {
            type: 'text_link',
            offset: 5,
            length: 4,
            url: 'https://example.com',
          },
        ],
      });

      expect(result.error).toBeUndefined();
    });

    it('rejects invalid urls and out-of-range entities', () => {
      const invalidUrl = joiCreateNotificationSchema.validate({
        type: NotificationTypes.MESSAGE,
        message: 'Text link',
        messageEntities: [
          {
            type: 'text_link',
            offset: 5,
            length: 4,
            url: 'javascript:alert(1)',
          },
        ],
      });
      const invalidRange = joiCreateNotificationSchema.validate({
        type: NotificationTypes.MESSAGE,
        message: 'Text link',
        messageEntities: [
          {
            type: 'text_link',
            offset: 5,
            length: 99,
            url: 'https://example.com',
          },
        ],
      });

      expect(invalidUrl.error).toBeDefined();
      expect(invalidRange.error).toBeDefined();
    });

    it('rejects too many entities and entities without message', () => {
      const tooManyEntities = joiCreateNotificationSchema.validate({
        type: NotificationTypes.MESSAGE,
        message: 'Text link',
        messageEntities: Array.from({ length: 51 }, () => ({
          type: 'url',
          offset: 0,
          length: 4,
        })),
      });
      const withoutMessage = joiCreateNotificationSchema.validate({
        type: NotificationTypes.MESSAGE,
        messageEntities: [
          {
            type: 'url',
            offset: 0,
            length: 4,
          },
        ],
      });

      expect(tooManyEntities.error).toBeDefined();
      expect(withoutMessage.error).toBeDefined();
    });
  });

  it('clears stale message entities on message-only updates', async () => {
    const exec = jest.fn().mockResolvedValue({});
    mockNotificationModel.findByIdAndUpdate.mockReturnValue({ exec });

    await service.update('notification-id', { message: 'Updated text' });

    expect(mockNotificationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'notification-id',
      expect.objectContaining({
        message: 'Updated text',
        messageEntities: [],
      }),
    );
  });

  describe('addReceived', () => {
    it('returns true only when the call claims a new received user', async () => {
      const exec = jest.fn().mockResolvedValue({ _id: 'notification-id' });
      const updateStatusSpy = jest
        .spyOn(service, 'updateNotificationStatus')
        .mockResolvedValue(undefined);
      mockUsersService.getById.mockResolvedValue({ _id: 'user-id' });
      mockNotificationModel.findOneAndUpdate.mockReturnValue({ exec });

      await expect(
        service.addReceived('notification-id', 'user-id'),
      ).resolves.toBe(true);

      expect(mockNotificationModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'notification-id',
          received: {
            $not: { $elemMatch: { $eq: 'user-id' } },
          },
        },
        {
          $addToSet: { received: 'user-id' },
        },
      );
      expect(updateStatusSpy).toHaveBeenCalledWith('notification-id');
      expect(mockNotificationModel.findOne).not.toHaveBeenCalled();
    });

    it('returns false when the user was already received', async () => {
      const exec = jest.fn().mockResolvedValue(null);
      const updateStatusSpy = jest
        .spyOn(service, 'updateNotificationStatus')
        .mockResolvedValue(undefined);
      mockUsersService.getById.mockResolvedValue({ _id: 'user-id' });
      mockNotificationModel.findOneAndUpdate.mockReturnValue({ exec });

      await expect(
        service.addReceived('notification-id', 'user-id'),
      ).resolves.toBe(false);

      expect(updateStatusSpy).not.toHaveBeenCalled();
      expect(mockNotificationModel.findOne).not.toHaveBeenCalled();
    });

    it('returns false when the user cannot be found', async () => {
      const updateStatusSpy = jest
        .spyOn(service, 'updateNotificationStatus')
        .mockResolvedValue(undefined);
      mockUsersService.getById.mockResolvedValue(null);

      await expect(
        service.addReceived('notification-id', 'missing-user-id'),
      ).resolves.toBe(false);

      expect(mockNotificationModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(updateStatusSpy).not.toHaveBeenCalled();
    });
  });
});
