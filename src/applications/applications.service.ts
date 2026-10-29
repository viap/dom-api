import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { UsersService } from '@/users/users.service';
import { DomainsService } from '@/domains/domains.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationTypes } from '@/notifications/enums/notification-types.enum';
import { Role } from '@/roles/enums/roles.enum';
import { parsePublicWebUrl } from '@/common/utils/web-origin';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreatePublicApplicationDto } from './dto/create-public-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationFormType } from './enums/application-form-type.enum';
import { ApplicationQueryParams } from './types/query-params.interface';
import { Application, ApplicationDocument } from './schemas/application.schema';
import {
  PreferredContact,
  PreferredContactInput,
  PreferredContactType,
} from './types/preferred-contact.type';
import { TelegramContactService } from '@/telegram-contact/telegram-contact.service';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { ApplicationMessagingPolicyService } from '@/common/application-messaging/application-messaging-policy.service';
import {
  buildApplicationAdminUrl,
  formatApplicationNotification,
} from './application-notification';
import {
  ApplicationContextResolver,
  ApplicationSourceContext,
  PAYLOAD_TARGET_KEY,
  toApplicationIdString,
} from './application-context-resolver.service';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);
  private readonly publicWebOrigin: string;

  constructor(
    @InjectModel(Application.name)
    private applicationModel: Model<ApplicationDocument>,
    private readonly contextResolver: ApplicationContextResolver,
    private readonly domainsService: DomainsService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    private telegramContactService: TelegramContactService,
    configService: ConfigService,
    private readonly messagingPolicy: ApplicationMessagingPolicyService,
  ) {
    this.publicWebOrigin = parsePublicWebUrl(
      configService.get<string>('PUBLIC_WEB_URL'),
    );
  }

  async create(
    createApplicationDto: CreateApplicationDto,
  ): Promise<ApplicationDocument> {
    if (
      createApplicationDto.schemaVersion === 3 &&
      createApplicationDto.applicant.preferredContact.type ===
        PreferredContactType.TelegramIdentity
    ) {
      throw new BadRequestException(
        'Verified Telegram contact requires a remembered session',
      );
    }

    return this.createResolved(createApplicationDto);
  }

  async createFromPublicWeb(
    dto: CreatePublicApplicationDto,
  ): Promise<ApplicationDocument> {
    const { application } = dto;

    if (
      application.schemaVersion !== 3 ||
      application.applicant.preferredContact.type !==
        PreferredContactType.TelegramIdentity
    ) {
      return this.createResolved(application);
    }

    if (!dto.contactSessionToken) {
      this.throwContactUnavailable('Telegram contact session is required');
    }

    let resolvedContact: Awaited<
      ReturnType<TelegramContactService['resolveSession']>
    >;
    try {
      resolvedContact = await this.telegramContactService.resolveSession(
        dto.contactSessionToken,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.throwContactUnavailable('Telegram contact session is invalid');
      }
      throw error;
    }
    const { identity, summary } = resolvedContact;
    if (!this.messagingPolicy.canUseAsSoleContact(summary.username)) {
      this.throwContactUnavailable(
        'A Telegram account without a username cannot be the sole contact',
      );
    }

    const preferredContact: PreferredContact = {
      type: PreferredContactType.TelegramIdentity,
      identityId: identity._id.toString(),
      ...(summary.username ? { usernameSnapshot: summary.username } : {}),
      verifiedAt: summary.verifiedAt,
    };

    return this.createResolved({
      ...application,
      applicant: {
        ...application.applicant,
        preferredContact,
      },
    });
  }

  private throwContactUnavailable(message: string): never {
    throw new BadRequestException({
      statusCode: 400,
      code: 'contact_unavailable',
      message,
    });
  }

  private async createResolved(
    createApplicationDto: CreateApplicationDto,
  ): Promise<ApplicationDocument> {
    const context = await this.contextResolver.resolve({
      domainId: createApplicationDto.domainId,
      formType: createApplicationDto.formType,
      source: createApplicationDto.source,
      payload: createApplicationDto.payload as unknown as Record<
        string,
        unknown
      >,
    });

    const applicant =
      createApplicationDto.schemaVersion === 3
        ? this.buildV3Applicant(createApplicationDto.applicant)
        : createApplicationDto.applicant;

    const application = new this.applicationModel({
      ...createApplicationDto,
      applicant,
      domainId: context.domainId,
      ...(context.source ? { source: context.source } : {}),
    });
    const savedApplication = await application.save();
    await this.createAdminNotification(savedApplication, context.targetTitle);
    return savedApplication;
  }

  private buildV3Applicant(applicant: {
    name: string;
    preferredContact: PreferredContactInput;
  }): Application['applicant'] {
    const { preferredContact } = applicant;
    const contacts = (() => {
      if (preferredContact.type === PreferredContactType.TelegramUsername) {
        return [
          {
            network: SocialNetworks.Telegram,
            username: `@${preferredContact.username}`,
            hidden: false,
          },
        ];
      }

      if (preferredContact.type === PreferredContactType.TelegramIdentity) {
        if (!('identityId' in preferredContact)) {
          throw new BadRequestException(
            'Verified Telegram contact requires a remembered session',
          );
        }
        const identityContact = preferredContact as PreferredContact & {
          type: PreferredContactType.TelegramIdentity;
        };
        return identityContact.usernameSnapshot
          ? [
              {
                network: SocialNetworks.Telegram,
                username: `@${identityContact.usernameSnapshot}`,
                hidden: false,
              },
            ]
          : [];
      }

      return [
        {
          network: SocialNetworks.Phone,
          username: preferredContact.phoneE164,
          hidden: false,
        },
      ];
    })();

    return {
      name: applicant.name,
      preferredContact: preferredContact as PreferredContact,
      contacts,
    };
  }

  private async createAdminNotification(
    application: ApplicationDocument,
    targetTitle: string | null,
  ): Promise<void> {
    const applicationId = application._id.toString();
    let stage = 'format';

    try {
      const applicationUrl = buildApplicationAdminUrl(
        this.publicWebOrigin,
        applicationId,
      );

      const { message, messageEntities } = formatApplicationNotification({
        formType: application.formType,
        applicantName: application.applicant.name,
        targetTitle,
        publicWebOrigin: this.publicWebOrigin,
        applicationUrl,
      });

      stage = 'create';
      // Explicit recipients let the notification deactivate once every admin
      // got it, instead of staying active for its whole lifetime.
      const admins = await this.usersService.getAllByRole(Role.Admin);
      const notification = await this.notificationsService.create({
        type: NotificationTypes.MESSAGE,
        message,
        messageEntities,
        roles: [Role.Admin],
        recipients: admins.map((admin) => admin._id.toString()),
      });

      if (!notification) {
        this.logNotificationFailure(
          applicationId,
          stage,
          new Error('Notification validation rejected the payload'),
          'warn',
        );
      }
    } catch (error) {
      this.logNotificationFailure(applicationId, stage, error, 'error');
    }
  }

  private logNotificationFailure(
    applicationId: string,
    stage: string,
    error: unknown,
    level: 'error' | 'warn',
  ): void {
    const reason = error instanceof Error ? error.name : typeof error;
    const message = [
      'Application notification failed',
      `applicationId=${applicationId}`,
      `stage=${stage}`,
      `reason=${reason}`,
    ]
      .filter(Boolean)
      .join(' ');
    this.logger[level](message);
  }

  async findAll(
    queryParams: ApplicationQueryParams = {},
  ): Promise<ApplicationDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
    const query: Record<string, unknown> = {};

    if (safeParams.domainId && typeof safeParams.domainId === 'string') {
      await this.domainsService.getActiveById(safeParams.domainId);
      query.domainId = safeParams.domainId;
    }

    if (safeParams.formType && typeof safeParams.formType === 'string') {
      query.formType = safeParams.formType;
    }

    if (safeParams.status && typeof safeParams.status === 'string') {
      query.status = safeParams.status;
    }

    if (safeParams.assignedTo && typeof safeParams.assignedTo === 'string') {
      query.assignedTo = safeParams.assignedTo;
    }

    return this.applicationModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<ApplicationDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid application ID format');
    }

    const application = await this.applicationModel
      .findById(validId)
      .lean()
      .exec();
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application as ApplicationDocument;
  }

  async update(
    id: string,
    updateApplicationDto: UpdateApplicationDto,
  ): Promise<ApplicationDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid application ID format');
    }

    const existingApplication = await this.applicationModel
      .findById(validId)
      .lean()
      .exec();
    if (!existingApplication) {
      throw new NotFoundException('Application not found');
    }

    const updateData: Record<string, unknown> = { ...updateApplicationDto };
    for (const [key, value] of Object.entries(updateData)) {
      if (value === undefined) {
        delete updateData[key];
      }
    }

    const hasDomainUpdate = typeof updateApplicationDto.domainId === 'string';
    const hasSourceUpdate = updateApplicationDto.source !== undefined;
    const hasPayloadUpdate = updateApplicationDto.payload !== undefined;
    const existingSource = this.normalizeSource(
      existingApplication.source as unknown,
    );
    const effectiveSource = hasSourceUpdate
      ? this.mergeSource(existingSource, updateApplicationDto.source)
      : existingSource;
    const existingPayload = this.toRecord(existingApplication.payload);
    const replacementPayload = hasPayloadUpdate
      ? this.toRecord(updateApplicationDto.payload)
      : existingPayload;
    const formType = existingApplication.formType as ApplicationFormType;
    const existingDomainId = toApplicationIdString(
      existingApplication.domainId,
    );
    const targetKey = PAYLOAD_TARGET_KEY[formType];
    // A supplied payload is a full replacement. Normalized target comparison avoids
    // refetching unchanged targets for payload-only updates. When context resolution
    // is needed, any payload target replaces inherited source identity canonically.
    const payloadTargetChanged =
      toApplicationIdString(existingPayload[targetKey]) !==
      toApplicationIdString(replacementPayload[targetKey]);
    const changesTargetContext =
      (hasDomainUpdate && updateApplicationDto.domainId !== existingDomainId) ||
      this.hasSourceIdentityChanged(existingSource, effectiveSource) ||
      payloadTargetChanged;

    let unsetResolvedSource = false;

    if (changesTargetContext) {
      const sourceForResolution =
        payloadTargetChanged ||
        toApplicationIdString(replacementPayload[targetKey])
          ? this.buildSourceForResolvedTarget(
              effectiveSource,
              updateApplicationDto.source,
            )
          : effectiveSource;
      const context = await this.contextResolver.resolve({
        formType,
        domainId: hasDomainUpdate ? updateApplicationDto.domainId : undefined,
        fallbackDomainId: existingDomainId,
        source: sourceForResolution,
        payload: replacementPayload,
      });

      updateData.domainId = context.domainId;
      if (context.source) {
        updateData.source = context.source;
      } else {
        delete updateData.source;
        unsetResolvedSource = true;
      }
      if (hasPayloadUpdate) {
        updateData.payload = replacementPayload;
      }
    } else {
      if (hasSourceUpdate) {
        updateData.source = effectiveSource;
      }
      if (hasPayloadUpdate) {
        updateData.payload = replacementPayload;
      }
    }

    await this.validateUpdateRefs(updateApplicationDto);

    const mongoUpdate = {
      $set: updateData,
      ...(unsetResolvedSource ? { $unset: { source: 1 } } : {}),
    };
    const application = await this.applicationModel
      .findByIdAndUpdate(validId, mongoUpdate, { new: true })
      .lean()
      .exec();

    return application as ApplicationDocument;
  }

  private async validateUpdateRefs(data: UpdateApplicationDto): Promise<void> {
    if (data.assignedTo) {
      const user = await this.usersService.getById(data.assignedTo);
      if (!user) {
        throw new BadRequestException('Referenced assigned user not found');
      }
    }

    if (data.notes) {
      for (const note of data.notes) {
        const user = await this.usersService.getById(note.authorId);
        if (!user) {
          throw new BadRequestException('Referenced note author not found');
        }
      }
    }
  }

  private normalizeSource(
    value: unknown,
  ): ApplicationSourceContext | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const source = value as Record<string, unknown>;
    const entityId = toApplicationIdString(source.entityId);
    const utm = this.toStringRecord(source.utm);
    return {
      ...(typeof source.entityType === 'string'
        ? { entityType: source.entityType }
        : {}),
      ...(entityId ? { entityId } : {}),
      ...(utm ? { utm } : {}),
    };
  }

  private mergeSource(
    existing: ApplicationSourceContext | undefined,
    update: ApplicationSourceContext | undefined,
  ): ApplicationSourceContext | undefined {
    if (!update) {
      return existing;
    }
    return {
      ...existing,
      ...Object.fromEntries(
        Object.entries(update).filter(([, value]) => value !== undefined),
      ),
    };
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  private hasSourceIdentityChanged(
    existing: ApplicationSourceContext | undefined,
    effective: ApplicationSourceContext | undefined,
  ): boolean {
    return (
      existing?.entityType !== effective?.entityType ||
      existing?.entityId !== effective?.entityId
    );
  }

  private buildSourceForResolvedTarget(
    effective: ApplicationSourceContext | undefined,
    update: ApplicationSourceContext | undefined,
  ): ApplicationSourceContext | undefined {
    const source: ApplicationSourceContext = {
      ...(typeof update?.entityType === 'string'
        ? { entityType: update.entityType }
        : {}),
      ...(typeof update?.entityId === 'string'
        ? { entityId: update.entityId }
        : {}),
      ...(effective?.utm ? { utm: effective.utm } : {}),
    };
    return Object.keys(source).length > 0 ? source : undefined;
  }

  private toStringRecord(value: unknown): Record<string, string> | undefined {
    if (value instanceof Map) {
      return Object.fromEntries(value) as Record<string, string>;
    }
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    return { ...(value as Record<string, string>) };
  }
}
