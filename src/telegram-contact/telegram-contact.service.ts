import {
  BadRequestException,
  GoneException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { ApiClientDto } from '@/api-clients/dto/api-client.dto';
import { TelegramUserDto } from '@/auth/dto/telegram.dto';
import { isTrustedApiClient } from '@/auth/utils/client-ip';
import { TelegramLinkStatus } from '@/telegram-contact/enums/telegram-link-status.enum';
import {
  TelegramContactSession,
  TelegramContactSessionDocument,
} from '@/telegram-contact/schemas/telegram-contact-session.schema';
import {
  TelegramIdentity,
  TelegramIdentityDocument,
} from '@/telegram-contact/schemas/telegram-identity.schema';
import { TelegramLinkSession } from '@/telegram-contact/schemas/telegram-link-session.schema';
import { TelegramContactSummary } from '@/telegram-contact/types/telegram-contact-summary.interface';
import { UsersService } from '@/users/users.service';
import { validateObjectId } from '@/common/utils/mongo-sanitizer';

const PENDING_LINK_TTL_MS = 10 * 60 * 1000;
const LINKED_LINK_TTL_MS = 30 * 60 * 1000;
const CONTACT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TELEGRAM_BOT_USERNAME_PATTERN = /^[A-Za-z0-9_]{5,32}$/;

function parseTelegramBotUsername(value: string | undefined): string {
  const username = value?.trim();
  if (!username || !TELEGRAM_BOT_USERNAME_PATTERN.test(username)) {
    throw new Error(
      'TELEGRAM_BOT_USERNAME must be a valid Telegram username without @',
    );
  }
  return username;
}

type ResolvedContactSession = {
  session: TelegramContactSessionDocument;
  identity: TelegramIdentityDocument;
  summary: TelegramContactSummary;
};

@Injectable()
export class TelegramContactService {
  private readonly telegramBotUsername: string;

  constructor(
    @InjectModel(TelegramIdentity.name)
    private readonly identityModel: Model<TelegramIdentity>,
    @InjectModel(TelegramLinkSession.name)
    private readonly linkSessionModel: Model<TelegramLinkSession>,
    @InjectModel(TelegramContactSession.name)
    private readonly contactSessionModel: Model<TelegramContactSession>,
    private readonly usersService: UsersService,
    configService: ConfigService,
  ) {
    this.telegramBotUsername = parseTelegramBotUsername(
      configService.get<string>('TELEGRAM_BOT_USERNAME'),
    );
  }

  assertTrustedWebClient(apiClient: ApiClientDto): void {
    if (!isTrustedApiClient(apiClient, 'WEB')) {
      throw new UnauthorizedException('Invalid API client');
    }
  }

  private assertTrustedBotClient(apiClient: ApiClientDto): void {
    if (!isTrustedApiClient(apiClient, 'BOT')) {
      throw new UnauthorizedException('Invalid API client');
    }
  }

  async createLink(apiClient: ApiClientDto) {
    this.assertTrustedWebClient(apiClient);

    const startToken = this.createSecret();
    const browserProof = this.createSecret();
    const expiresAt = new Date(Date.now() + PENDING_LINK_TTL_MS);
    const linkSession = await this.linkSessionModel.create({
      publicId: randomUUID(),
      startTokenHash: this.hashSecret(startToken),
      browserProofHash: this.hashSecret(browserProof),
      status: TelegramLinkStatus.Pending,
      expiresAt,
    });

    return {
      linkId: linkSession.publicId,
      startToken,
      telegramUrl: `https://t.me/${this.telegramBotUsername}?start=app_${startToken}`,
      browserProof,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirmLink(input: {
    apiClient: ApiClientDto;
    startToken: string;
    privateChatId: string;
    telegram: TelegramUserDto;
  }): Promise<{ status: 'linked' | 'already_linked' }> {
    this.assertTrustedBotClient(input.apiClient);

    if (input.privateChatId !== input.telegram.id) {
      throw new BadRequestException('Telegram link must use a private chat');
    }

    const now = new Date();
    const linkSession = await this.linkSessionModel
      .findOne({ startTokenHash: this.hashSecret(input.startToken) })
      .select('+startTokenHash')
      .exec();

    if (!linkSession || linkSession.expiresAt <= now) {
      throw new GoneException('Telegram link has expired');
    }

    if (linkSession.status !== TelegramLinkStatus.Pending) {
      return { status: 'already_linked' };
    }

    const identity = await this.upsertIdentity(
      input.telegram,
      input.privateChatId,
      now,
    );
    const linked = await this.linkSessionModel
      .findOneAndUpdate(
        {
          _id: linkSession._id,
          status: TelegramLinkStatus.Pending,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            status: TelegramLinkStatus.Linked,
            identityId: identity._id,
            linkedAt: now,
            expiresAt: new Date(now.getTime() + LINKED_LINK_TTL_MS),
          },
        },
        { new: true },
      )
      .exec();

    return { status: linked ? 'linked' : 'already_linked' };
  }

  async exchangeLink(input: {
    apiClient: ApiClientDto;
    browserProof: string;
    currentSessionToken?: string;
  }): Promise<
    | { status: 'pending' | 'completed' }
    | {
        status: 'linked';
        sessionToken: string;
        expiresAt: string;
        contact: TelegramContactSummary;
      }
  > {
    this.assertTrustedWebClient(input.apiClient);
    const now = new Date();
    const linkSession = await this.linkSessionModel
      .findOne({ browserProofHash: this.hashSecret(input.browserProof) })
      .select('+browserProofHash')
      .exec();

    if (!linkSession || linkSession.expiresAt <= now) {
      throw new GoneException('Telegram link has expired');
    }

    if (linkSession.status === TelegramLinkStatus.Pending) {
      return { status: 'pending' };
    }

    if (linkSession.status === TelegramLinkStatus.Consumed) {
      return { status: 'completed' };
    }

    const claimed = await this.linkSessionModel
      .findOneAndUpdate(
        {
          _id: linkSession._id,
          status: TelegramLinkStatus.Linked,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            status: TelegramLinkStatus.Consumed,
            consumedAt: now,
          },
        },
        { new: true },
      )
      .exec();

    if (!claimed?.identityId) {
      return { status: 'completed' };
    }

    const validIdentityId = validateObjectId(claimed.identityId.toString());
    const identity = validIdentityId
      ? await this.identityModel.findById(validIdentityId).exec()
      : null;
    if (!identity) {
      throw new GoneException('Telegram identity is unavailable');
    }

    const sessionToken = this.createSecret();
    const expiresAt = new Date(now.getTime() + CONTACT_SESSION_TTL_MS);
    await this.contactSessionModel.create({
      identityId: identity._id,
      tokenHash: this.hashSecret(sessionToken),
      lastUsedAt: now,
      expiresAt,
    });

    if (input.currentSessionToken) {
      await this.revokeSessionToken(input.currentSessionToken, now);
    }

    return {
      status: 'linked',
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      contact: this.toSummary(identity),
    };
  }

  async getSession(
    apiClient: ApiClientDto,
    sessionToken: string,
  ): Promise<TelegramContactSummary> {
    this.assertTrustedWebClient(apiClient);
    return (await this.resolveSession(sessionToken)).summary;
  }

  async resolveSession(sessionToken: string): Promise<ResolvedContactSession> {
    const now = new Date();
    const session = await this.contactSessionModel
      .findOne({
        tokenHash: this.hashSecret(sessionToken),
        revokedAt: { $exists: false },
        expiresAt: { $gt: now },
      })
      .select('+tokenHash')
      .exec();

    if (!session) {
      throw new UnauthorizedException('Telegram contact session is invalid');
    }

    const validIdentityId = validateObjectId(session.identityId.toString());
    const identity = validIdentityId
      ? await this.identityModel.findById(validIdentityId).exec()
      : null;
    if (!identity) {
      throw new UnauthorizedException('Telegram contact session is invalid');
    }

    session.lastUsedAt = now;
    await session.save();

    return { session, identity, summary: this.toSummary(identity) };
  }

  async forgetSession(
    apiClient: ApiClientDto,
    sessionToken: string,
  ): Promise<{ forgotten: true }> {
    this.assertTrustedWebClient(apiClient);
    await this.revokeSessionToken(sessionToken, new Date());
    return { forgotten: true };
  }

  async getIdentityForMessaging(
    identityId: string,
  ): Promise<TelegramIdentityDocument | null> {
    const validIdentityId = validateObjectId(identityId);
    if (!validIdentityId) return null;
    return this.identityModel.findById(validIdentityId).exec();
  }

  async findIdentityForReply(
    telegramUserId: string,
    privateChatId: string,
  ): Promise<TelegramIdentityDocument | null> {
    if (
      !/^\d{1,20}$/.test(telegramUserId) ||
      privateChatId !== telegramUserId
    ) {
      return null;
    }
    return this.identityModel.findOne({ telegramUserId, privateChatId }).exec();
  }

  private async upsertIdentity(
    telegram: TelegramUserDto,
    privateChatId: string,
    now: Date,
  ): Promise<TelegramIdentityDocument> {
    const ownerId = await this.usersService.findTelegramLoginOwnerId(
      telegram.id,
    );
    const username = telegram.username?.trim() || undefined;
    const displayName = [telegram.first_name, telegram.last_name]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join(' ');
    const unsetFields = {
      ...(!username ? { username: 1 } : {}),
      ...(!displayName ? { displayName: 1 } : {}),
    };
    const update: Record<string, unknown> = {
      $set: {
        privateChatId,
        verifiedAt: now,
        lastSeenAt: now,
        ...(username ? { username } : {}),
        ...(displayName ? { displayName } : {}),
        ...(ownerId ? { userId: ownerId } : {}),
      },
      $setOnInsert: { telegramUserId: telegram.id },
      ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}),
    };

    return this.identityModel
      .findOneAndUpdate({ telegramUserId: telegram.id }, update, {
        new: true,
        upsert: true,
      })
      .exec();
  }

  private async revokeSessionToken(token: string, revokedAt: Date) {
    await this.contactSessionModel
      .updateOne(
        {
          tokenHash: this.hashSecret(token),
          revokedAt: { $exists: false },
        },
        { $set: { revokedAt } },
      )
      .exec();
  }

  private toSummary(
    identity: TelegramIdentityDocument,
  ): TelegramContactSummary {
    return {
      identityId: identity._id.toString(),
      ...(identity.username ? { username: identity.username } : {}),
      ...(identity.displayName ? { displayName: identity.displayName } : {}),
      verifiedAt: identity.verifiedAt.toISOString(),
    };
  }

  private createSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
