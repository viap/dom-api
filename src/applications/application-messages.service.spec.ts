import { ApplicationMessagesService } from './application-messages.service';
import { Types } from 'mongoose';
import {
  ApplicationMessageDirection,
  ApplicationMessageStatus,
} from './enums/application-message.enum';

describe('ApplicationMessagesService', () => {
  const originalBotName = process.env.BOT_CLIENT_NAME;
  const originalBotPassword = process.env.BOT_CLIENT_PASSWORD;
  const applicationId = '507f1f77bcf86cd799439031';
  const identityId = '507f1f77bcf86cd799439077';
  const senderId = '507f1f77bcf86cd799439099';
  const messageId = '507f1f77bcf86cd799439088';
  const now = new Date('2026-10-28T08:00:00.000Z');

  const application = {
    _id: applicationId,
    applicant: {
      name: 'Applicant',
      preferredContact: {
        type: 'telegram_identity',
        identityId: new Types.ObjectId(identityId),
      },
    },
  };
  const identity = {
    _id: identityId,
    telegramUserId: '42',
    privateChatId: '42',
  };
  const outbound = {
    _id: messageId,
    applicationId,
    telegramIdentityId: identityId,
    direction: ApplicationMessageDirection.Outbound,
    text: 'Hello',
    status: ApplicationMessageStatus.Pending,
    senderUserId: senderId,
    senderDisplayName: 'Editor Jane',
    clientMessageId: '7bba6527-e154-4c47-9f15-2ec5569f30b7',
    createdAt: now,
    updatedAt: now,
  };

  let messageModel: Record<string, jest.Mock>;
  let applicationModel: Record<string, jest.Mock>;
  let telegramContactService: Record<string, jest.Mock>;
  let usersService: Record<string, jest.Mock>;
  let notificationsService: Record<string, jest.Mock>;
  let messagingPolicy: { enabled: boolean; canUseAsSoleContact: jest.Mock };
  let service: ApplicationMessagesService;

  beforeEach(() => {
    process.env.BOT_CLIENT_NAME = 'domBot';
    process.env.BOT_CLIENT_PASSWORD = 'bot-secret';
    messageModel = {
      aggregate: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      updateOne: jest.fn(),
    };
    applicationModel = { find: jest.fn(), findById: jest.fn() };
    telegramContactService = {
      getIdentityForMessaging: jest.fn(),
      findIdentityForReply: jest.fn(),
    };
    usersService = {
      getById: jest.fn(),
      getAllByRole: jest.fn(),
    };
    notificationsService = { create: jest.fn() };
    messagingPolicy = {
      enabled: true,
      canUseAsSoleContact: jest.fn().mockReturnValue(true),
    };
    service = new ApplicationMessagesService(
      messageModel as any,
      applicationModel as any,
      telegramContactService as any,
      usersService as any,
      notificationsService as any,
      {
        get: jest.fn((key: string) =>
          key === 'APPLICATION_MESSAGING_ENABLED'
            ? 'true'
            : 'https://www.example.test',
        ),
      } as any,
      messagingPolicy as any,
    );
  });

  afterAll(() => {
    process.env.BOT_CLIENT_NAME = originalBotName;
    process.env.BOT_CLIENT_PASSWORD = originalBotPassword;
  });

  function mockApplicationLookup(value = application) {
    applicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(value),
      }),
    });
  }

  it('queues an official-bot message with a server-owned sender snapshot', async () => {
    mockApplicationLookup();
    telegramContactService.getIdentityForMessaging.mockResolvedValue(identity);
    messageModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    usersService.getById.mockResolvedValue({
      _id: senderId,
      name: ' Editor   Jane ',
    });
    messageModel.create.mockImplementation(async (value) => ({
      ...outbound,
      ...value,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await service.createOutbound(
      applicationId,
      { clientMessageId: outbound.clientMessageId, text: ' Hello ' },
      { userId: senderId, roles: [] },
    );

    expect(telegramContactService.getIdentityForMessaging).toHaveBeenCalledWith(
      identityId,
    );
    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId,
        telegramIdentityId: identityId,
        text: 'Hello',
        senderDisplayName: 'Editor Jane',
        status: ApplicationMessageStatus.Pending,
      }),
    );
    expect(result.status).toBe(ApplicationMessageStatus.Pending);
  });

  it('atomically claims pending delivery for the verified private chat', async () => {
    messageModel.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    });
    messageModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...outbound,
        status: ApplicationMessageStatus.Sending,
      }),
    });
    telegramContactService.getIdentityForMessaging.mockResolvedValue(identity);

    const result = await service.claimNext({
      apiClient: { name: 'domBot', password: 'bot-secret' },
    });

    expect(result.message).toEqual({
      id: messageId,
      applicationId,
      privateChatId: '42',
      text: 'DOM — Editor Jane\n\nHello',
    });
    expect(messageModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ApplicationMessageStatus.Sending,
        claimedAt: { $lt: expect.any(Date) },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: ApplicationMessageStatus.Unknown,
          deliveryErrorCode: 'delivery_lease_expired',
        }),
      }),
    );
  });

  it('cleans queued and leased messages only when messaging is explicitly disabled', async () => {
    messagingPolicy.enabled = false;
    messageModel.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    await service.onModuleInit();

    expect(messageModel.updateMany).toHaveBeenNthCalledWith(
      1,
      { status: ApplicationMessageStatus.Pending },
      {
        $set: {
          status: ApplicationMessageStatus.Failed,
          deliveryErrorCode: 'messaging_disabled',
        },
      },
    );
    expect(messageModel.updateMany).toHaveBeenNthCalledWith(
      2,
      { status: ApplicationMessageStatus.Sending },
      {
        $set: {
          status: ApplicationMessageStatus.Unknown,
          deliveryErrorCode: 'messaging_disabled_during_delivery',
        },
      },
    );
  });

  it('accepts an authoritative late sent report while messaging is disabled', async () => {
    messagingPolicy.enabled = false;
    const existing = {
      ...outbound,
      status: ApplicationMessageStatus.Unknown,
      deliveryErrorCode: 'messaging_disabled_during_delivery',
    };
    const updated = {
      ...existing,
      status: ApplicationMessageStatus.Sent,
      telegramMessageId: 101,
      sentAt: now,
      deliveryErrorCode: undefined,
    };
    messageModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existing),
    });
    messageModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });

    const result = await service.reportDelivery({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      messageId,
      status: ApplicationMessageStatus.Sent,
      telegramMessageId: 101,
    });

    expect(result.status).toBe(ApplicationMessageStatus.Sent);
    expect(messageModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: messageId, status: { $in: [ApplicationMessageStatus.Unknown] } },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: ApplicationMessageStatus.Sent,
          telegramMessageId: 101,
        }),
        $unset: expect.objectContaining({ deliveryErrorCode: 1 }),
      }),
      { new: true },
    );
  });

  it('treats repeated unknown reports as idempotent diagnostic updates', async () => {
    const existing = {
      ...outbound,
      status: ApplicationMessageStatus.Unknown,
      deliveryErrorCode: 'delivery_transport_unknown',
    };
    messageModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existing),
    });

    const result = await service.reportDelivery({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      messageId,
      status: ApplicationMessageStatus.Unknown,
      errorCode: 'delivery_lease_expired',
    });

    expect(result.status).toBe(ApplicationMessageStatus.Unknown);
    expect(messageModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps contradictory terminal delivery reports rejected', async () => {
    messageModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        ...outbound,
        status: ApplicationMessageStatus.Sent,
        telegramMessageId: 101,
      }),
    });

    await expect(
      service.reportDelivery({
        apiClient: { name: 'domBot', password: 'bot-secret' },
        messageId,
        status: ApplicationMessageStatus.Failed,
        errorCode: 'telegram_403',
      }),
    ).rejects.toThrow('terminal');
  });

  it('retries a Sending to Unknown race and records the late sent report', async () => {
    const sending = {
      ...outbound,
      status: ApplicationMessageStatus.Sending,
    };
    const unknown = {
      ...outbound,
      status: ApplicationMessageStatus.Unknown,
      deliveryErrorCode: 'delivery_lease_expired',
    };
    const sent = {
      ...unknown,
      status: ApplicationMessageStatus.Sent,
      telegramMessageId: 101,
      sentAt: now,
    };
    messageModel.findById
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(sending) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(unknown) });
    messageModel.findOneAndUpdate
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(sent) });

    const result = await service.reportDelivery({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      messageId,
      status: ApplicationMessageStatus.Sent,
      telegramMessageId: 101,
    });

    expect(result.status).toBe(ApplicationMessageStatus.Sent);
    expect(messageModel.findById).toHaveBeenCalledTimes(2);
    expect(messageModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('accepts an identical terminal report applied during the race', async () => {
    const sending = {
      ...outbound,
      status: ApplicationMessageStatus.Sending,
    };
    const sent = {
      ...outbound,
      status: ApplicationMessageStatus.Sent,
      telegramMessageId: 101,
      sentAt: now,
    };
    messageModel.findById
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(sending) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(sent) });
    messageModel.findOneAndUpdate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(null),
    });

    const result = await service.reportDelivery({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      messageId,
      status: ApplicationMessageStatus.Sent,
      telegramMessageId: 101,
    });

    expect(result.status).toBe(ApplicationMessageStatus.Sent);
    expect(messageModel.findById).toHaveBeenCalledTimes(2);
    expect(messageModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('bounds delivery report race recovery to one retry', async () => {
    const sending = {
      ...outbound,
      status: ApplicationMessageStatus.Sending,
    };
    messageModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(sending),
    });
    messageModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.reportDelivery({
        apiClient: { name: 'domBot', password: 'bot-secret' },
        messageId,
        status: ApplicationMessageStatus.Sent,
        telegramMessageId: 101,
      }),
    ).rejects.toThrow('report raced');

    expect(messageModel.findById).toHaveBeenCalledTimes(2);
    expect(messageModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('lists only started threads owned by the verified Telegram identity', async () => {
    telegramContactService.findIdentityForReply.mockResolvedValue(identity);
    messageModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(applicationId),
          lastMessageAt: now,
          outboundCount: 1,
        },
      ]),
    });
    applicationModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(applicationId),
            formType: 'event_registration',
            source: { entityType: 'event' },
            createdAt: now,
          },
        ]),
      }),
    });

    const result = await service.listThreads({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      privateChatId: '42',
      telegramUserId: '42',
      page: 0,
    });

    expect(result).toEqual({
      enabled: true,
      threads: [
        {
          applicationId,
          formType: 'event_registration',
          sourceEntityType: 'event',
          createdAt: now.toISOString(),
          lastMessageAt: now.toISOString(),
        },
      ],
      page: 0,
      hasMore: false,
    });
    expect(messageModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({ telegramIdentityId: identityId }),
        }),
      ]),
    );
    expect(
      messageModel.aggregate.mock.calls[0][0][1].$group.outboundCount.$sum
        .$cond[0],
    ).toEqual({
      $and: [
        {
          $eq: ['$direction', ApplicationMessageDirection.Outbound],
        },
        { $eq: ['$status', ApplicationMessageStatus.Sent] },
      ],
    });
  });

  it('casts an application filter to ObjectId before aggregating threads', async () => {
    telegramContactService.findIdentityForReply.mockResolvedValue(identity);
    messageModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    const result = await service.listThreads({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      privateChatId: '42',
      telegramUserId: '42',
      applicationId,
      page: 0,
    });

    expect(result).toEqual({
      enabled: true,
      threads: [],
      page: 0,
      hasMore: false,
    });
    const [pipeline] = messageModel.aggregate.mock.calls[0] as [
      Array<{ $match?: Record<string, unknown> }>,
    ];
    const applicationFilter = pipeline[0].$match?.applicationId;
    expect(applicationFilter).toBeInstanceOf(Types.ObjectId);
    expect(String(applicationFilter)).toBe(applicationId);
  });

  it('returns the original application text and chronological history for a selected thread', async () => {
    telegramContactService.findIdentityForReply.mockResolvedValue({
      ...identity,
      displayName: 'Telegram Name',
      username: 'telegram_user',
    });
    messageModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(applicationId),
          lastMessageAt: now,
          outboundCount: 1,
        },
      ]),
    });
    applicationModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(applicationId),
            formType: 'event_registration',
            applicant: { name: 'Application Name' },
            payload: { message: 'Initial request' },
            createdAt: now,
          },
        ]),
      }),
    });
    messageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([
            {
              ...outbound,
              status: ApplicationMessageStatus.Sent,
            },
            {
              ...outbound,
              _id: '507f1f77bcf86cd799439089',
              direction: ApplicationMessageDirection.Inbound,
              text: 'Applicant answer',
              status: ApplicationMessageStatus.Received,
              senderDisplayName: undefined,
            },
          ]),
        }),
      }),
    });

    const result = await service.listThreads({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      privateChatId: '42',
      telegramUserId: '42',
      applicationId,
      page: 0,
    });

    expect(result.threads).toEqual([
      expect.objectContaining({
        applicationId,
        applicantDisplayName: 'Application Name',
        initialMessage: 'Initial request',
        messages: [
          {
            direction: ApplicationMessageDirection.Outbound,
            text: 'Hello',
            senderDisplayName: 'Editor Jane',
            createdAt: now.toISOString(),
          },
          {
            direction: ApplicationMessageDirection.Inbound,
            text: 'Applicant answer',
            createdAt: now.toISOString(),
          },
        ],
      }),
    ]);
    expect(messageModel.find).toHaveBeenCalledWith({
      applicationId: new Types.ObjectId(applicationId),
      telegramIdentityId: identityId,
      $or: [
        { direction: ApplicationMessageDirection.Inbound },
        {
          direction: ApplicationMessageDirection.Outbound,
          status: ApplicationMessageStatus.Sent,
        },
      ],
    });
  });

  it('falls back to the Telegram display name for the admin thread label', async () => {
    mockApplicationLookup({
      ...application,
      applicant: {
        ...application.applicant,
        name: '   ',
      },
    });
    telegramContactService.getIdentityForMessaging.mockResolvedValue({
      ...identity,
      displayName: ' Telegram   Name ',
      username: 'telegram_user',
    });
    messageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await service.getThread(applicationId);

    expect(result.applicantDisplayName).toBe('Telegram Name');
  });

  it('stores a reply once and notifies only current admins without reply text', async () => {
    telegramContactService.findIdentityForReply.mockResolvedValue(identity);
    messageModel.findOne
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(outbound) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });
    messageModel.create.mockResolvedValue({});
    mockApplicationLookup();
    usersService.getAllByRole.mockResolvedValue([
      { _id: { toString: () => senderId } },
    ]);
    notificationsService.create.mockResolvedValue({ _id: 'notification' });

    const result = await service.receiveReply({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      privateChatId: '42',
      telegramUserId: '42',
      telegramMessageId: 101,
      replyToTelegramMessageId: 100,
      text: 'Applicant reply',
    });

    expect(result).toEqual({
      accepted: true,
      stored: true,
      applicationId,
    });
    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId,
        direction: ApplicationMessageDirection.Inbound,
        status: ApplicationMessageStatus.Received,
        text: 'Applicant reply',
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ['admin'],
        recipients: [senderId],
      }),
    );
    expect(
      JSON.stringify(notificationsService.create.mock.calls[0][0]),
    ).not.toContain('Applicant reply');
  });

  it('accepts a selected owned thread without requiring native Reply', async () => {
    telegramContactService.findIdentityForReply.mockResolvedValue(identity);
    messageModel.findOne
      .mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(outbound),
        }),
      })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });
    messageModel.create.mockResolvedValue({});
    mockApplicationLookup();
    usersService.getAllByRole.mockResolvedValue([]);
    notificationsService.create.mockResolvedValue({ _id: 'notification' });

    const result = await service.receiveReply({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      privateChatId: '42',
      telegramUserId: '42',
      telegramMessageId: 102,
      applicationId,
      text: 'Selected thread reply',
    });

    expect(result).toEqual({
      accepted: true,
      stored: true,
      applicationId,
    });
    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId,
        telegramIdentityId: identityId,
        text: 'Selected thread reply',
      }),
    );
    expect(messageModel.create.mock.calls[0][0]).not.toHaveProperty(
      'replyToTelegramMessageId',
    );
  });

  it('rejects a selected thread that has no official outbound message', async () => {
    telegramContactService.findIdentityForReply.mockResolvedValue(identity);
    messageModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      service.receiveReply({
        apiClient: { name: 'domBot', password: 'bot-secret' },
        privateChatId: '42',
        telegramUserId: '42',
        telegramMessageId: 103,
        applicationId,
        text: 'Forged selection',
      }),
    ).resolves.toEqual({ accepted: false });
    expect(messageModel.create).not.toHaveBeenCalled();
  });

  it('rejects an inbound message without exactly one thread selector', async () => {
    await expect(
      service.receiveReply({
        apiClient: { name: 'domBot', password: 'bot-secret' },
        privateChatId: '42',
        telegramUserId: '42',
        telegramMessageId: 104,
        text: 'Unrouted reply',
      }),
    ).resolves.toEqual({ accepted: false });
    expect(telegramContactService.findIdentityForReply).not.toHaveBeenCalled();
  });
});
