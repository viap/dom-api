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
import { ApplicationMessagingPolicyService } from '@/common/application-messaging/application-messaging-policy.service';

const PENDING_LINK_TTL_MS = 10 * 60 * 1000;
const LINKED_LINK_TTL_MS = 30 * 60 * 1000;
const CONFIRMATION_LEASE_MS = 2 * 60 * 1000;
const CONTACT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CONTACT_SESSION_LAST_USED_WRITE_INTERVAL_MS = 15 * 60 * 1000;
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
    private readonly messagingPolicy: ApplicationMessagingPolicyService,
  ) {
    this.telegramBotUsername = parseTelegramBotUsername(
      configService.get<string>('TELEGRAM_BOT_USERNAME'),
    );
  }

  async createLink() {
    const startToken = this.createSecret();
    const browserProof = this.createSecret();
    const expiresAt = new Date(Date.now() + PENDING_LINK_TTL_MS);
    const browserProofExpiresAt = new Date(
      expiresAt.getTime() + LINKED_LINK_TTL_MS,
    );
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
      browserProofExpiresAt: browserProofExpiresAt.toISOString(),
    };
  }

  async confirmLink(input: {
    apiClient: ApiClientDto;
    startToken: string;
    privateChatId: string;
    telegram: TelegramUserDto;
  }): Promise<{
    status: 'linked' | 'already_linked' | 'cancelled' | 'in_progress';
  }> {
    if (input.privateChatId !== input.telegram.id) {
      throw new BadRequestException('Telegram link must use a private chat');
    }

    const now = new Date();
    const startTokenHash = this.hashSecret(input.startToken);
    const claimed = await this.linkSessionModel
      .findOneAndUpdate(
        {
          startTokenHash,
          $or: [
            { status: TelegramLinkStatus.Pending },
            {
              status: TelegramLinkStatus.Confirming,
              $or: [
                {
                  confirmationClaimedAt: {
                    $lt: new Date(now.getTime() - CONFIRMATION_LEASE_MS),
                  },
                },
                { confirmationClaimedAt: { $exists: false } },
              ],
            },
          ],
          expiresAt: { $gt: now },
        },
        {
          $set: {
            status: TelegramLinkStatus.Confirming,
            confirmationClaimedAt: now,
          },
        },
        { new: true },
      )
      .exec();

    if (!claimed) {
      const existing = await this.linkSessionModel
        .findOne({ startTokenHash })
        .select('+startTokenHash')
        .exec();
      if (!existing || existing.expiresAt <= now) {
        throw new GoneException('Telegram link has expired');
      }
      if (existing.status === TelegramLinkStatus.Cancelled) {
        return { status: 'cancelled' };
      }
      if (existing.status === TelegramLinkStatus.Confirming) {
        return { status: 'in_progress' };
      }
      return { status: 'already_linked' };
    }

    let identity: TelegramIdentityDocument;
    try {
      identity = await this.upsertIdentity(
        input.telegram,
        input.privateChatId,
        now,
      );
    } catch (error) {
      await this.linkSessionModel
        .updateOne(
          { _id: claimed._id, status: TelegramLinkStatus.Confirming },
          {
            $set: { status: TelegramLinkStatus.Pending },
            $unset: { confirmationClaimedAt: 1 },
          },
        )
        .exec();
      throw error;
    }

    const linked = await this.linkSessionModel
      .findOneAndUpdate(
        { _id: claimed._id, status: TelegramLinkStatus.Confirming },
        {
          $set: {
            status: TelegramLinkStatus.Linked,
            identityId: identity._id,
            linkedAt: now,
            expiresAt: new Date(now.getTime() + LINKED_LINK_TTL_MS),
          },
          $unset: { confirmationClaimedAt: 1 },
        },
        { new: true },
      )
      .exec();

    return { status: linked ? 'linked' : 'already_linked' };
  }

  async cancelLink(startToken: string): Promise<{ status: 'cancelled' }> {
    const now = new Date();
    const cancelled = await this.linkSessionModel
      .findOneAndUpdate(
        {
          startTokenHash: this.hashSecret(startToken),
          status: TelegramLinkStatus.Pending,
          expiresAt: { $gt: now },
        },
        { $set: { status: TelegramLinkStatus.Cancelled } },
        { new: true },
      )
      .exec();
    if (!cancelled) {
      throw new GoneException('Telegram link has expired');
    }
    return { status: 'cancelled' };
  }

  async exchangeLink(input: {
    apiClient: ApiClientDto;
    browserProof: string;
    currentSessionToken?: string;
  }): Promise<
    | { status: 'pending' | 'completed' | 'cancelled' }
    | {
        status: 'linked';
        sessionToken: string;
        expiresAt: string;
        contact: TelegramContactSummary;
      }
  > {
    const now = new Date();
    const linkSession = await this.linkSessionModel
      .findOne({ browserProofHash: this.hashSecret(input.browserProof) })
      .select('+browserProofHash')
      .exec();

    if (!linkSession || linkSession.expiresAt <= now) {
      throw new GoneException('Telegram link has expired');
    }

    if (
      linkSession.status === TelegramLinkStatus.Pending ||
      linkSession.status === TelegramLinkStatus.Confirming
    ) {
      return { status: 'pending' };
    }

    if (linkSession.status === TelegramLinkStatus.Consumed) {
      return { status: 'completed' };
    }

    if (linkSession.status === TelegramLinkStatus.Cancelled) {
      return { status: 'cancelled' };
    }

    if (linkSession.status !== TelegramLinkStatus.Linked) {
      return { status: 'completed' };
    }

    if (!linkSession.identityId) {
      throw new GoneException('Telegram identity is unavailable');
    }

    const validIdentityId = validateObjectId(linkSession.identityId.toString());
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

    if (!claimed) {
      await this.revokeSessionToken(sessionToken, now);
      return { status: 'completed' };
    }

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

  async getSession(sessionToken: string): Promise<TelegramContactSummary> {
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

    if (
      session.lastUsedAt.getTime() <=
      now.getTime() - CONTACT_SESSION_LAST_USED_WRITE_INTERVAL_MS
    ) {
      await this.contactSessionModel
        .updateOne(
          {
            _id: session._id,
            lastUsedAt: {
              $lte: new Date(
                now.getTime() - CONTACT_SESSION_LAST_USED_WRITE_INTERVAL_MS,
              ),
            },
          },
          { $set: { lastUsedAt: now } },
        )
        .exec();
    }

    return { session, identity, summary: this.toSummary(identity) };
  }

  async forgetSession(sessionToken: string): Promise<{ forgotten: true }> {
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
    if (ownerId) {
      await this.identityModel
        .updateMany(
          { userId: ownerId, telegramUserId: { $ne: telegram.id } },
          { $unset: { userId: 1 } },
        )
        .exec();
    }
    const username = telegram.username?.trim() || undefined;
    const displayName = [telegram.first_name, telegram.last_name]
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join(' ');
    const unsetFields = {
      ...(!username ? { username: 1 } : {}),
      ...(!displayName ? { displayName: 1 } : {}),
      ...(!ownerId ? { userId: 1 } : {}),
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

    try {
      return await this.executeIdentityUpsert(telegram.id, update);
    } catch (error) {
      if (!this.isRetryableIdentityDuplicate(error)) throw error;
      return this.executeIdentityUpsert(telegram.id, update);
    }
  }

  private isRetryableIdentityDuplicate(error: unknown): boolean {
    const duplicate = error as {
      code?: number;
      keyPattern?: Record<string, unknown>;
    } | null;
    if (duplicate?.code !== 11000) return false;
    const keys = Object.keys(duplicate.keyPattern || {});
    return keys.includes('telegramUserId') || keys.includes('userId');
  }

  private executeIdentityUpsert(
    telegramUserId: string,
    update: Record<string, unknown>,
  ): Promise<TelegramIdentityDocument> {
    return this.identityModel
      .findOneAndUpdate({ telegramUserId }, update, { new: true, upsert: true })
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
      soleContactAllowed: this.messagingPolicy.canUseAsSoleContact(
        identity.username,
      ),
    };
  }

  private createSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
