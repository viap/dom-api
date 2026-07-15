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

    const mockUsersService = {
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
});
