import { UnauthorizedException } from '@nestjs/common';
import { TelegramLinkStatus } from './enums/telegram-link-status.enum';
import { TelegramContactService } from './telegram-contact.service';

describe('TelegramContactService security boundary', () => {
  const originalWebName = process.env.WEB_CLIENT_NAME;
  const originalWebPassword = process.env.WEB_CLIENT_PASSWORD;
  const originalBotName = process.env.BOT_CLIENT_NAME;
  const originalBotPassword = process.env.BOT_CLIENT_PASSWORD;

  const identityModel = { findById: jest.fn(), findOneAndUpdate: jest.fn() };
  const linkSessionModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const contactSessionModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  };
  const usersService = { findTelegramLoginOwnerId: jest.fn() };
  const configService = {
    get: jest.fn().mockReturnValue('PsyDom_Tbilisi_Test_bot'),
  };

  let service: TelegramContactService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEB_CLIENT_NAME = 'domWeb';
    process.env.WEB_CLIENT_PASSWORD = 'web-secret';
    process.env.BOT_CLIENT_NAME = 'domBot';
    process.env.BOT_CLIENT_PASSWORD = 'bot-secret';
    service = new TelegramContactService(
      identityModel as any,
      linkSessionModel as any,
      contactSessionModel as any,
      usersService as any,
      configService as any,
    );
  });

  afterAll(() => {
    process.env.WEB_CLIENT_NAME = originalWebName;
    process.env.WEB_CLIENT_PASSWORD = originalWebPassword;
    process.env.BOT_CLIENT_NAME = originalBotName;
    process.env.BOT_CLIENT_PASSWORD = originalBotPassword;
  });

  it('stores hashes instead of raw link secrets', async () => {
    linkSessionModel.create.mockImplementationOnce(async (value) => value);
    const result = await service.createLink({
      name: 'domWeb',
      password: 'web-secret',
    });
    const stored = linkSessionModel.create.mock.calls[0][0];

    expect(result.startToken).toHaveLength(43);
    expect(result.telegramUrl).toBe(
      `https://t.me/PsyDom_Tbilisi_Test_bot?start=app_${result.startToken}`,
    );
    expect(result.browserProof).toHaveLength(43);
    expect(stored.startTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.browserProofHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.startTokenHash).not.toBe(result.startToken);
    expect(stored.browserProofHash).not.toBe(result.browserProof);
  });

  it('fails construction when TELEGRAM_BOT_USERNAME is invalid', () => {
    expect(
      () =>
        new TelegramContactService(
          identityModel as any,
          linkSessionModel as any,
          contactSessionModel as any,
          usersService as any,
          { get: jest.fn().mockReturnValue('@invalid') } as any,
        ),
    ).toThrow('TELEGRAM_BOT_USERNAME');
  });

  it('rejects untrusted web clients before creating a link', async () => {
    await expect(
      service.createLink({ name: 'domWeb', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(linkSessionModel.create).not.toHaveBeenCalled();
  });

  it('rejects bot confirmation when chat and Telegram user differ', async () => {
    await expect(
      service.confirmLink({
        apiClient: { name: 'domBot', password: 'bot-secret' },
        startToken: 's'.repeat(43),
        privateChatId: '42',
        telegram: { id: '43', username: 'jane_doe' },
      }),
    ).rejects.toThrow('private chat');
    expect(linkSessionModel.findOne).not.toHaveBeenCalled();
  });

  it('keeps repeated bot confirmation idempotent', async () => {
    linkSessionModel.findOne.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          status: TelegramLinkStatus.Linked,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      }),
    });

    await expect(
      service.confirmLink({
        apiClient: { name: 'domBot', password: 'bot-secret' },
        startToken: 's'.repeat(43),
        privateChatId: '42',
        telegram: { id: '42', username: 'jane_doe' },
      }),
    ).resolves.toEqual({ status: 'already_linked' });
    expect(identityModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(usersService.findTelegramLoginOwnerId).not.toHaveBeenCalled();
  });

  it('stores the verified Telegram display name', async () => {
    const identity = {
      _id: { toString: () => '507f1f77bcf86cd799439077' },
      username: 'jane_doe',
      displayName: 'Jane Doe',
      verifiedAt: new Date('2026-10-28T08:00:00.000Z'),
    };
    linkSessionModel.findOne.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'link-id',
          status: TelegramLinkStatus.Pending,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      }),
    });
    usersService.findTelegramLoginOwnerId.mockResolvedValueOnce(null);
    identityModel.findOneAndUpdate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(identity),
    });
    linkSessionModel.findOneAndUpdate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({ identityId: identity._id }),
    });

    await service.confirmLink({
      apiClient: { name: 'domBot', password: 'bot-secret' },
      startToken: 's'.repeat(43),
      privateChatId: '42',
      telegram: {
        id: '42',
        username: 'jane_doe',
        first_name: ' Jane ',
        last_name: ' Doe ',
      },
    });

    expect(identityModel.findOneAndUpdate).toHaveBeenCalledWith(
      { telegramUserId: '42' },
      expect.objectContaining({
        $set: expect.objectContaining({ displayName: 'Jane Doe' }),
      }),
      expect.objectContaining({ new: true, upsert: true }),
    );
  });

  it('creates a fixed 30-day session before revoking the old device session', async () => {
    const identity = {
      _id: { toString: () => '507f1f77bcf86cd799439077' },
      username: 'jane_doe',
      verifiedAt: new Date('2026-10-28T08:00:00.000Z'),
    };
    linkSessionModel.findOne.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'link-id',
          identityId: identity._id,
          status: TelegramLinkStatus.Linked,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      }),
    });
    linkSessionModel.findOneAndUpdate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({
        identityId: identity._id,
      }),
    });
    identityModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(identity),
    });
    contactSessionModel.create.mockImplementationOnce(async (value) => value);
    contactSessionModel.updateOne.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    const result = await service.exchangeLink({
      apiClient: { name: 'domWeb', password: 'web-secret' },
      browserProof: 'p'.repeat(43),
      currentSessionToken: 'o'.repeat(43),
    });
    const created = contactSessionModel.create.mock.calls[0][0];

    expect(result.status).toBe('linked');
    if (result.status !== 'linked') {
      throw new Error('Expected linked session exchange result');
    }
    expect(created.expiresAt.getTime() - created.lastUsedAt.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.tokenHash).not.toBe(result.sessionToken);
    expect(contactSessionModel.create.mock.invocationCallOrder[0]).toBeLessThan(
      contactSessionModel.updateOne.mock.invocationCallOrder[0],
    );
  });

  it('updates last-used telemetry without sliding the session expiry', async () => {
    const fixedExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = {
      identityId: { toString: () => '507f1f77bcf86cd799439077' },
      expiresAt: fixedExpiry,
      lastUsedAt: new Date(0),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const identity = {
      _id: session.identityId,
      username: 'jane_doe',
      displayName: 'Jane Doe',
      verifiedAt: new Date('2026-10-28T08:00:00.000Z'),
    };
    contactSessionModel.findOne.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(session),
      }),
    });
    identityModel.findById.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(identity),
    });

    const resolved = await service.resolveSession('s'.repeat(43));

    expect(session.lastUsedAt.getTime()).toBeGreaterThan(0);
    expect(session.expiresAt).toBe(fixedExpiry);
    expect(session.save).toHaveBeenCalledTimes(1);
    expect(resolved.summary.displayName).toBe('Jane Doe');
  });
});
