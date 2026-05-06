import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { ProgramsService } from '@/programs/programs.service';
import { UsersService } from '@/users/users.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationFormType } from './enums/application-form-type.enum';
import { ApplicationQueryParams } from './types/query-params.interface';
import { Application, ApplicationDocument } from './schemas/application.schema';

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
  constructor(
    @InjectModel(Application.name)
    private applicationModel: Model<ApplicationDocument>,
    private domainsService: DomainsService,
    private programsService: ProgramsService,
    private eventsService: EventsService,
    private partnersService: PartnersService,
    private usersService: UsersService,
  ) {}

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
    return application.save();
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

    if (typeof data.payload?.programId === 'string') {
      const exists = await this.programsService.exists(data.payload.programId);
      if (!exists) {
        throw new BadRequestException('Referenced program not found');
      }
    }

    if (typeof data.payload?.eventId === 'string') {
      const exists = await this.eventsService.exists(data.payload.eventId);
      if (!exists) {
        throw new BadRequestException('Referenced event not found');
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

    throw new BadRequestException('Unsupported source entityType');
  }
}
