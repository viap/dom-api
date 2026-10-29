import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApplicationMessagingPolicyService } from '@/common/application-messaging/application-messaging-policy.service';
import { UserContext } from '@/common/user-context/user-context.interface';
import { validateObjectId } from '@/common/utils/mongo-sanitizer';
import { parsePublicWebUrl } from '@/common/utils/web-origin';
import { NotificationTypes } from '@/notifications/enums/notification-types.enum';
import { NotificationsService } from '@/notifications/notifications.service';
import { Role } from '@/roles/enums/roles.enum';
import { TelegramContactService } from '@/telegram-contact/telegram-contact.service';
import { UsersService } from '@/users/users.service';
import {
  buildApplicationAdminUrl,
  formatApplicationReplyNotification,
} from './application-notification';
import {
  ClaimApplicationMessageDto,
  CreateApplicationMessageDto,
  ListApplicationMessageThreadsDto,
  ReceiveApplicationReplyDto,
  ReportApplicationMessageDto,
} from './dto/application-message.dto';
import {
  ApplicationMessageDirection,
  ApplicationMessageStatus,
} from './enums/application-message.enum';
import {
  ApplicationMessage,
  ApplicationMessageDocument,
} from './schemas/application-message.schema';
import { Application, ApplicationDocument } from './schemas/application.schema';
import { PreferredContactType } from './types/preferred-contact.type';

const DELIVERY_LEASE_MS = 2 * 60 * 1000;
const MAX_CLAIM_SKIPS = 5;
const APPLICATION_THREAD_PAGE_SIZE = 10;

type MongoDuplicateError = { code?: number };
type ApplicationMessageViewSource = {
  _id: unknown;
  applicationId: unknown;
  direction: ApplicationMessageDirection;
  text: string;
  status: ApplicationMessageStatus;
  senderUserId?: unknown;
  senderDisplayName?: string;
  telegramMessageId?: number;
  deliveryErrorCode?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ApplicationThreadAggregate = {
  _id: unknown;
  lastMessageAt: Date;
};

type ApplicationThreadSource = {
  _id: unknown;
  formType: string;
  source?: { entityType?: string };
  applicant?: { name?: string };
  payload?: Record<string, unknown>;
  createdAt: Date | string;
};

type TelegramApplicantIdentity = {
  displayName?: string;
  username?: string;
};

function isDuplicateKeyError(error: unknown): error is MongoDuplicateError {
  return (error as MongoDuplicateError | null)?.code === 11000;
}

function normalizeDisplayName(value: string | undefined): string {
  return (value || '').replace(/\s+/gu, ' ').trim().slice(0, 129) || 'DOM';
}

function normalizeApplicantName(value: string | undefined): string | undefined {
  return (value || '').replace(/\s+/gu, ' ').trim().slice(0, 150) || undefined;
}

function resolveApplicantDisplayName(
  applicationName: string | undefined,
  identity: TelegramApplicantIdentity | null | undefined,
): string | undefined {
  return (
    normalizeApplicantName(applicationName) ||
    normalizeApplicantName(identity?.displayName) ||
    (identity?.username?.trim() ? `@${identity.username.trim()}` : undefined)
  );
}

function getInitialApplicationMessage(
  payload: Record<string, unknown> | undefined,
): string | undefined {
  const value =
    typeof payload?.message === 'string'
      ? payload.message
      : typeof payload?.requestText === 'string'
      ? payload.requestText
      : undefined;
  return value?.trim() || undefined;
}

@Injectable()
export class ApplicationMessagesService implements OnModuleInit {
  private readonly logger = new Logger(ApplicationMessagesService.name);
  private readonly publicWebOrigin: string;

  constructor(
    @InjectModel(ApplicationMessage.name)
    private readonly messageModel: Model<ApplicationMessageDocument>,
    @InjectModel(Application.name)
    private readonly applicationModel: Model<ApplicationDocument>,
    private readonly telegramContactService: TelegramContactService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    configService: ConfigService,
    private readonly messagingPolicy: ApplicationMessagingPolicyService,
  ) {
    this.publicWebOrigin = parsePublicWebUrl(
      configService.get<string>('PUBLIC_WEB_URL'),
    );
  }

  async onModuleInit(): Promise<void> {
    if (this.messagingPolicy.enabled) return;
    await Promise.all([
      this.messageModel
        .updateMany(
          { status: ApplicationMessageStatus.Pending },
          {
            $set: {
              status: ApplicationMessageStatus.Failed,
              deliveryErrorCode: 'messaging_disabled',
            },
          },
        )
        .exec(),
      this.messageModel
        .updateMany(
          { status: ApplicationMessageStatus.Sending },
          {
            $set: {
              status: ApplicationMessageStatus.Unknown,
              deliveryErrorCode: 'messaging_disabled_during_delivery',
            },
          },
        )
        .exec(),
    ]);
  }

  async getThread(applicationId: string) {
    const application = await this.getApplication(applicationId);
    const contact = application.applicant?.preferredContact;
    const available = contact?.type === PreferredContactType.TelegramIdentity;
    const identity = available
      ? await this.telegramContactService.getIdentityForMessaging(
          contact.identityId.toString(),
        )
      : null;
    const applicantDisplayName = resolveApplicantDisplayName(
      application.applicant?.name,
      identity,
    );
    const messages = await this.messageModel
      .find({ applicationId: application._id })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    return {
      enabled: this.messagingPolicy.enabled,
      available,
      ...(applicantDisplayName ? { applicantDisplayName } : {}),
      messages: messages.map((message) => this.toAdminMessage(message)),
    };
  }

  async createOutbound(
    applicationId: string,
    dto: CreateApplicationMessageDto,
    userContext: UserContext,
  ) {
    this.assertEnabled();
    const application = await this.getApplication(applicationId);
    const contact = application.applicant?.preferredContact;
    if (contact?.type !== PreferredContactType.TelegramIdentity) {
      throw new BadRequestException(
        'Official Telegram messaging requires a verified identity',
      );
    }

    const identity = await this.telegramContactService.getIdentityForMessaging(
      contact.identityId.toString(),
    );
    if (!identity) {
      throw new BadRequestException(
        'Verified Telegram identity is unavailable',
      );
    }

    const text = dto.text.trim();
    const existing = await this.messageModel
      .findOne({ clientMessageId: dto.clientMessageId })
      .exec();
    if (existing) {
      this.assertIdempotentMatch(
        existing,
        applicationId,
        userContext.userId,
        text,
      );
      return this.toAdminMessage(existing);
    }

    const sender = await this.usersService.getById(userContext.userId);
    if (!sender) throw new UnauthorizedException('Current user is unavailable');

    try {
      const created = await this.messageModel.create({
        applicationId: application._id,
        telegramIdentityId: identity._id,
        direction: ApplicationMessageDirection.Outbound,
        text,
        status: ApplicationMessageStatus.Pending,
        senderUserId: sender._id,
        senderDisplayName: normalizeDisplayName(sender.name),
        clientMessageId: dto.clientMessageId,
      });
      return this.toAdminMessage(created);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const raced = await this.messageModel
        .findOne({ clientMessageId: dto.clientMessageId })
        .exec();
      if (!raced) throw error;
      this.assertIdempotentMatch(
        raced,
        applicationId,
        userContext.userId,
        text,
      );
      return this.toAdminMessage(raced);
    }
  }

  async claimNext(_dto: ClaimApplicationMessageDto) {
    void _dto;
    if (!this.messagingPolicy.enabled) return { enabled: false, message: null };

    const now = new Date();
    await this.messageModel
      .updateMany(
        {
          status: ApplicationMessageStatus.Sending,
          claimedAt: { $lt: new Date(now.getTime() - DELIVERY_LEASE_MS) },
        },
        {
          $set: {
            status: ApplicationMessageStatus.Unknown,
            deliveryErrorCode: 'delivery_lease_expired',
          },
        },
      )
      .exec();

    for (let attempt = 0; attempt < MAX_CLAIM_SKIPS; attempt += 1) {
      const message = await this.messageModel
        .findOneAndUpdate(
          { status: ApplicationMessageStatus.Pending },
          {
            $set: {
              status: ApplicationMessageStatus.Sending,
              claimedAt: now,
            },
          },
          { new: true, sort: { createdAt: 1 } },
        )
        .exec();
      if (!message) return { enabled: true, message: null };

      const identity =
        await this.telegramContactService.getIdentityForMessaging(
          message.telegramIdentityId.toString(),
        );
      if (!identity) {
        await this.messageModel
          .updateOne(
            { _id: message._id, status: ApplicationMessageStatus.Sending },
            {
              $set: {
                status: ApplicationMessageStatus.Failed,
                deliveryErrorCode: 'telegram_identity_missing',
              },
            },
          )
          .exec();
        continue;
      }

      const sender = normalizeDisplayName(message.senderDisplayName);
      return {
        enabled: true,
        message: {
          id: message._id.toString(),
          applicationId: message.applicationId.toString(),
          privateChatId: identity.privateChatId,
          text: `DOM — ${sender}\n\n${message.text}`,
        },
      };
    }

    return { enabled: true, message: null };
  }

  async reportDelivery(dto: ReportApplicationMessageDto) {
    return this.reportDeliveryAttempt(dto, true);
  }

  private async reportDeliveryAttempt(
    dto: ReportApplicationMessageDto,
    retryOnRace: boolean,
  ) {
    const messageId = validateObjectId(dto.messageId);
    if (!messageId) throw new NotFoundException('Invalid message ID');

    const existing = await this.messageModel.findById(messageId).exec();
    if (!existing) throw new NotFoundException('Application message not found');
    if (existing.status === ApplicationMessageStatus.Sent) {
      if (
        dto.status === ApplicationMessageStatus.Sent &&
        existing.telegramMessageId === dto.telegramMessageId
      ) {
        return this.toAdminMessage(existing);
      }
      throw new ConflictException('Application message delivery is terminal');
    }
    if (existing.status === ApplicationMessageStatus.Failed) {
      if (
        dto.status === ApplicationMessageStatus.Failed &&
        existing.deliveryErrorCode === dto.errorCode
      ) {
        return this.toAdminMessage(existing);
      }
      throw new ConflictException('Application message delivery is terminal');
    }
    if (
      existing.status === ApplicationMessageStatus.Unknown &&
      dto.status === ApplicationMessageStatus.Unknown
    ) {
      return this.toAdminMessage(existing);
    }
    if (
      existing.status !== ApplicationMessageStatus.Sending &&
      existing.status !== ApplicationMessageStatus.Unknown
    ) {
      throw new ConflictException('Application message is not being delivered');
    }

    const set: Record<string, unknown> = { status: dto.status };
    if (dto.status === ApplicationMessageStatus.Sent) {
      set.telegramMessageId = dto.telegramMessageId;
      set.sentAt = new Date();
    } else {
      set.deliveryErrorCode = dto.errorCode;
    }

    const unset: Record<string, 1> = {};
    if (dto.status === ApplicationMessageStatus.Sent) {
      unset.deliveryErrorCode = 1;
    } else {
      unset.telegramMessageId = 1;
      unset.sentAt = 1;
    }
    const updated = await this.messageModel
      .findOneAndUpdate(
        {
          _id: messageId,
          status: { $in: [existing.status] },
        },
        { $set: set, $unset: unset },
        { new: true },
      )
      .exec();
    if (!updated) {
      if (retryOnRace) {
        return this.reportDeliveryAttempt(dto, false);
      }
      throw new ConflictException('Application message report raced');
    }
    return this.toAdminMessage(updated);
  }

  async listThreads(dto: ListApplicationMessageThreadsDto) {
    const page = dto.page ?? 0;
    if (!this.messagingPolicy.enabled) {
      return { enabled: false, threads: [], page, hasMore: false };
    }

    const identity = await this.telegramContactService.findIdentityForReply(
      dto.telegramUserId,
      dto.privateChatId,
    );
    if (!identity) {
      return { enabled: true, threads: [], page, hasMore: false };
    }

    const applicationId = dto.applicationId
      ? validateObjectId(dto.applicationId)
      : undefined;
    if (dto.applicationId && !applicationId) {
      return { enabled: true, threads: [], page, hasMore: false };
    }

    const match: Record<string, unknown> = {
      telegramIdentityId: identity._id,
      ...(applicationId
        ? { applicationId: new Types.ObjectId(applicationId) }
        : {}),
    };
    const grouped = (await this.messageModel
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: '$applicationId',
            lastMessageAt: { $max: '$createdAt' },
            outboundCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: [
                          '$direction',
                          ApplicationMessageDirection.Outbound,
                        ],
                      },
                      { $eq: ['$status', ApplicationMessageStatus.Sent] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $match: { outboundCount: { $gt: 0 } } },
        { $sort: { lastMessageAt: -1, _id: -1 } },
        { $skip: page * APPLICATION_THREAD_PAGE_SIZE },
        { $limit: APPLICATION_THREAD_PAGE_SIZE + 1 },
      ])
      .exec()) as Array<ApplicationThreadAggregate>;

    const visible = grouped.slice(0, APPLICATION_THREAD_PAGE_SIZE);
    const applications = visible.length
      ? ((await this.applicationModel
          .find({ _id: { $in: visible.map((thread) => thread._id) } })
          .lean()
          .exec()) as Array<ApplicationThreadSource>)
      : [];
    const applicationsById = new Map(
      applications.map((application) => [String(application._id), application]),
    );
    const selectedMessages =
      applicationId && visible.length
        ? await this.messageModel
            .find({
              applicationId: new Types.ObjectId(applicationId),
              telegramIdentityId: identity._id,
              $or: [
                { direction: ApplicationMessageDirection.Inbound },
                {
                  direction: ApplicationMessageDirection.Outbound,
                  status: ApplicationMessageStatus.Sent,
                },
              ],
            })
            .sort({ createdAt: 1 })
            .lean()
            .exec()
        : [];
    const threads = visible.flatMap((thread) => {
      const application = applicationsById.get(String(thread._id));
      if (!application) return [];
      const applicantDisplayName = resolveApplicantDisplayName(
        application.applicant?.name,
        identity,
      );
      const initialMessage = getInitialApplicationMessage(application.payload);
      return [
        {
          applicationId: String(application._id),
          formType: application.formType,
          ...(application.source?.entityType
            ? { sourceEntityType: application.source.entityType }
            : {}),
          ...(applicantDisplayName ? { applicantDisplayName } : {}),
          createdAt: new Date(application.createdAt).toISOString(),
          lastMessageAt: new Date(thread.lastMessageAt).toISOString(),
          ...(applicationId
            ? {
                ...(initialMessage ? { initialMessage } : {}),
                messages: selectedMessages.map((message) =>
                  this.toThreadMessage(message),
                ),
              }
            : {}),
        },
      ];
    });

    return {
      enabled: true,
      threads,
      page,
      hasMore: grouped.length > APPLICATION_THREAD_PAGE_SIZE,
    };
  }

  async receiveReply(dto: ReceiveApplicationReplyDto) {
    this.assertEnabled();
    if (Boolean(dto.replyToTelegramMessageId) === Boolean(dto.applicationId)) {
      return { accepted: false };
    }
    const identity = await this.telegramContactService.findIdentityForReply(
      dto.telegramUserId,
      dto.privateChatId,
    );
    if (!identity) return { accepted: false };

    const validApplicationId = dto.applicationId
      ? validateObjectId(dto.applicationId)
      : undefined;
    if (dto.applicationId && !validApplicationId) return { accepted: false };

    const outboundQuery = this.messageModel.findOne({
      telegramIdentityId: identity._id,
      direction: ApplicationMessageDirection.Outbound,
      status: ApplicationMessageStatus.Sent,
      ...(dto.replyToTelegramMessageId
        ? { telegramMessageId: dto.replyToTelegramMessageId }
        : { applicationId: validApplicationId }),
    });
    const outbound = dto.applicationId
      ? await outboundQuery.sort({ createdAt: -1 }).exec()
      : await outboundQuery.exec();
    if (!outbound) return { accepted: false };

    const text = dto.text?.trim() || '';
    if (!text) {
      return {
        accepted: true,
        stored: false,
        reason: 'text_required',
        applicationId: outbound.applicationId.toString(),
      };
    }

    const existing = await this.messageModel
      .findOne({
        telegramIdentityId: identity._id,
        telegramMessageId: dto.telegramMessageId,
        direction: ApplicationMessageDirection.Inbound,
      })
      .exec();
    if (existing) {
      return {
        accepted: true,
        stored: true,
        applicationId: outbound.applicationId.toString(),
      };
    }

    try {
      await this.messageModel.create({
        applicationId: outbound.applicationId,
        telegramIdentityId: identity._id,
        direction: ApplicationMessageDirection.Inbound,
        text,
        status: ApplicationMessageStatus.Received,
        telegramMessageId: dto.telegramMessageId,
        ...(dto.replyToTelegramMessageId
          ? { replyToTelegramMessageId: dto.replyToTelegramMessageId }
          : {}),
        receivedAt: new Date(),
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      return {
        accepted: true,
        stored: true,
        applicationId: outbound.applicationId.toString(),
      };
    }

    await this.createReplyNotification(outbound.applicationId.toString());
    return {
      accepted: true,
      stored: true,
      applicationId: outbound.applicationId.toString(),
    };
  }

  private async createReplyNotification(applicationId: string): Promise<void> {
    try {
      const application = await this.getApplication(applicationId);
      const admins = await this.usersService.getAllByRole(Role.Admin);
      const applicationUrl = buildApplicationAdminUrl(
        this.publicWebOrigin,
        applicationId,
      );
      const { message, messageEntities } = formatApplicationReplyNotification({
        applicantName: application.applicant.name,
        applicationUrl,
      });
      await this.notificationsService.create({
        type: NotificationTypes.MESSAGE,
        message,
        messageEntities,
        roles: [Role.Admin],
        recipients: admins.map((admin) => admin._id.toString()),
      });
    } catch (error) {
      this.logger.error(
        `Application reply notification failed applicationId=${applicationId} reason=${
          error instanceof Error ? error.name : typeof error
        }`,
      );
    }
  }

  private async getApplication(
    applicationId: string,
  ): Promise<ApplicationDocument> {
    const validApplicationId = validateObjectId(applicationId);
    if (!validApplicationId) {
      throw new NotFoundException('Invalid application ID format');
    }
    const application = await this.applicationModel
      .findById(validApplicationId)
      .lean()
      .exec();
    if (!application) throw new NotFoundException('Application not found');
    return application as ApplicationDocument;
  }

  private assertIdempotentMatch(
    message: ApplicationMessageDocument,
    applicationId: string,
    senderUserId: string,
    text: string,
  ): void {
    const normalizedApplicationId = validateObjectId(applicationId);
    if (
      !normalizedApplicationId ||
      message.applicationId.toString() !== normalizedApplicationId ||
      message.senderUserId?.toString() !== senderUserId ||
      message.text !== text
    ) {
      throw new ConflictException(
        'clientMessageId was already used for another message',
      );
    }
  }

  private assertEnabled(): void {
    if (!this.messagingPolicy.enabled) {
      throw new ServiceUnavailableException(
        'Application Telegram messaging is disabled',
      );
    }
  }

  private toAdminMessage(
    message: ApplicationMessageDocument | Record<string, unknown>,
  ) {
    const value = message as unknown as ApplicationMessageViewSource;
    return {
      id: String(value._id),
      applicationId: String(value.applicationId),
      direction: value.direction,
      text: value.text,
      status: value.status,
      ...(value.senderUserId
        ? { senderUserId: String(value.senderUserId) }
        : {}),
      ...(value.senderDisplayName
        ? { senderDisplayName: value.senderDisplayName }
        : {}),
      ...(value.telegramMessageId
        ? { telegramMessageId: value.telegramMessageId }
        : {}),
      ...(value.deliveryErrorCode
        ? { deliveryErrorCode: value.deliveryErrorCode }
        : {}),
      createdAt: new Date(value.createdAt).toISOString(),
      updatedAt: new Date(value.updatedAt).toISOString(),
    };
  }

  private toThreadMessage(
    message: ApplicationMessageDocument | Record<string, unknown>,
  ) {
    const value = message as unknown as ApplicationMessageViewSource;
    return {
      direction: value.direction,
      text: value.text,
      ...(value.senderDisplayName
        ? { senderDisplayName: value.senderDisplayName }
        : {}),
      createdAt: new Date(value.createdAt).toISOString(),
    };
  }
}
