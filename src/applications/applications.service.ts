import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
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
import { DomainCode } from '@/domains/enums/domain-code.enum';
import { DomainsService } from '@/domains/domains.service';
import { EventsService } from '@/events/events.service';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
import { ProgramsService } from '@/programs/programs.service';
import { UsersService } from '@/users/users.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationTypes } from '@/notifications/enums/notification-types.enum';
import { Role } from '@/roles/enums/roles.enum';
import { parsePublicWebUrl } from '@/common/utils/web-origin';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationFormType } from './enums/application-form-type.enum';
import { ApplicationQueryParams } from './types/query-params.interface';
import { Application, ApplicationDocument } from './schemas/application.schema';
import {
  buildApplicationAdminUrl,
  formatApplicationNotification,
  normalizeNotificationDisplayValue,
} from './application-notification';

const FORM_TYPE_DOMAIN_CODE_MAP: Record<ApplicationFormType, DomainCode> = {
  [ApplicationFormType.Partnership]: DomainCode.PsychCenter,
  [ApplicationFormType.ProgramEnrollment]: DomainCode.Academy,
  [ApplicationFormType.EventRegistration]: DomainCode.PsychCenter,
  [ApplicationFormType.CorporateTraining]: DomainCode.PsychCenter,
  [ApplicationFormType.SpecialistRequest]: DomainCode.PsychCenter,
  [ApplicationFormType.General]: DomainCode.PsychCenter,
};

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);
  private readonly publicWebOrigin: string;

  constructor(
    @InjectModel(Application.name)
    private applicationModel: Model<ApplicationDocument>,
    private domainsService: DomainsService,
    private programsService: ProgramsService,
    private eventsService: EventsService,
    private partnersService: PartnersService,
    private peopleService: PeopleService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    configService: ConfigService,
  ) {
    this.publicWebOrigin = parsePublicWebUrl(
      configService.get<string>('PUBLIC_WEB_URL'),
    );
  }

  async create(
    createApplicationDto: CreateApplicationDto,
  ): Promise<ApplicationDocument> {
    const domainId = await this.resolveEffectiveDomainId({
      domainId: createApplicationDto.domainId,
      formType: createApplicationDto.formType,
    });
    await this.validateDomainAndRefs({ ...createApplicationDto, domainId });

    const application = new this.applicationModel({
      ...createApplicationDto,
      domainId,
    });
    const savedApplication = await application.save();
    await this.createAdminNotification(savedApplication);
    return savedApplication;
  }

  private async createAdminNotification(
    application: ApplicationDocument,
  ): Promise<void> {
    const applicationId = application._id.toString();
    let stage = 'target-title';

    try {
      let targetTitle: string | null = null;
      try {
        targetTitle = await this.getNotificationTargetTitle(application);
      } catch (error) {
        this.logNotificationFailure(applicationId, stage, error, 'warn');
      }

      stage = 'format';
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
      const notification = await this.notificationsService.create({
        type: NotificationTypes.MESSAGE,
        message,
        messageEntities,
        roles: [Role.Admin],
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

  private async getNotificationTargetTitle(
    application: ApplicationDocument,
  ): Promise<string | null> {
    if (application.formType === ApplicationFormType.ProgramEnrollment) {
      const programId = application.payload?.programId;
      return typeof programId === 'string'
        ? this.programsService.getNotificationTitle(programId)
        : null;
    }

    if (application.formType === ApplicationFormType.EventRegistration) {
      const eventId = application.payload?.eventId;
      return typeof eventId === 'string'
        ? this.eventsService.getNotificationTitle(eventId)
        : null;
    }

    return null;
  }

  private logNotificationFailure(
    applicationId: string,
    stage: string,
    error: unknown,
    level: 'error' | 'warn',
  ): void {
    const reason = error instanceof Error ? error.name : typeof error;
    const detail =
      stage === 'target-title' && error instanceof Error
        ? normalizeNotificationDisplayValue(error.message)
        : '';
    const message = [
      'Application notification failed',
      `applicationId=${applicationId}`,
      `stage=${stage}`,
      `reason=${reason}`,
      detail ? `detail=${JSON.stringify(detail)}` : '',
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

    const hasDomainIdField = Object.prototype.hasOwnProperty.call(
      updateApplicationDto,
      'domainId',
    );
    const existingDomainId = existingApplication.domainId?.toString();
    const shouldResolveFallbackDomain = !hasDomainIdField && !existingDomainId;

    let resolvedDomainId: string | undefined;
    if (hasDomainIdField && typeof updateApplicationDto.domainId === 'string') {
      await this.domainsService.getActiveById(updateApplicationDto.domainId);
      resolvedDomainId = await this.resolveEffectiveDomainId({
        domainId: updateApplicationDto.domainId,
        formType: existingApplication.formType as ApplicationFormType,
      });
    } else if (shouldResolveFallbackDomain) {
      resolvedDomainId = await this.resolveEffectiveDomainId({
        formType: existingApplication.formType as ApplicationFormType,
      });
    }

    await this.validateUpdateRefs(updateApplicationDto);

    const updateData: Record<string, unknown> = { ...updateApplicationDto };
    if (hasDomainIdField && updateApplicationDto.domainId === undefined) {
      delete updateData.domainId;
    }
    if (resolvedDomainId) {
      updateData.domainId = resolvedDomainId;
    }

    const application = await this.applicationModel
      .findByIdAndUpdate(validId, updateData, { new: true })
      .lean()
      .exec();

    return application as ApplicationDocument;
  }

  private async resolveEffectiveDomainId(data: {
    formType: ApplicationFormType;
    domainId?: string;
  }): Promise<string> {
    if (typeof data.domainId === 'string') {
      return data.domainId;
    }

    const mappedCode = FORM_TYPE_DOMAIN_CODE_MAP[data.formType];
    if (!mappedCode) {
      throw new BadRequestException(
        `No domain mapping defined for formType: ${data.formType}`,
      );
    }
    const mappedDomain = await this.domainsService.getActiveByCode(mappedCode);
    return mappedDomain._id.toString();
  }

  private async validateDomainAndRefs(data: {
    domainId: string;
    source?: { entityType?: string; entityId?: string };
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.domainsService.getActiveById(data.domainId);
    await this.validateEntityReference(
      data.source?.entityType,
      data.source?.entityId,
    );
    await this.validatePayloadReferences(data.payload);
  }

  private async validatePayloadReferences(
    payload?: Record<string, unknown>,
  ): Promise<void> {
    if (!payload) {
      return;
    }

    if (typeof payload.programId === 'string') {
      const exists = await this.programsService.exists(payload.programId);
      if (!exists) {
        throw new BadRequestException('Referenced program not found');
      }
    }

    if (typeof payload.eventId === 'string') {
      const exists = await this.eventsService.exists(payload.eventId);
      if (!exists) {
        throw new BadRequestException('Referenced event not found');
      }
    }

    if (typeof payload.personId === 'string') {
      const exists = await this.peopleService.exists(payload.personId);
      if (!exists) {
        throw new BadRequestException('Referenced person not found');
      }
    }
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

    await this.validateEntityReference(
      data.source?.entityType,
      data.source?.entityId,
    );
    await this.validatePayloadReferences(data.payload);
  }

  private async validateEntityReference(
    entityType?: string,
    entityId?: string,
  ): Promise<void> {
    if (!entityType && !entityId) {
      return;
    }

    if (!entityType || !entityId) {
      throw new BadRequestException(
        'source.entityType and source.entityId must be provided together',
      );
    }

    if (entityType === 'program') {
      const exists = await this.programsService.exists(entityId);
      if (!exists) {
        throw new BadRequestException('Referenced program not found');
      }
      return;
    }

    if (entityType === 'event') {
      const exists = await this.eventsService.exists(entityId);
      if (!exists) {
        throw new BadRequestException('Referenced event not found');
      }
      return;
    }

    if (entityType === 'partner') {
      const exists = await this.partnersService.exists(entityId);
      if (!exists) {
        throw new BadRequestException('Referenced partner not found');
      }
      return;
    }

    if (entityType === 'person') {
      const exists = await this.peopleService.exists(entityId);
      if (!exists) {
        throw new BadRequestException('Referenced person not found');
      }
      return;
    }

    throw new BadRequestException('Unsupported source entityType');
  }
}
