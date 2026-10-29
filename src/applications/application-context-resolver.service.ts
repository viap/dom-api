import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainCode } from '@/domains/enums/domain-code.enum';
import { DomainsService } from '@/domains/domains.service';
import { EventsService } from '@/events/events.service';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
import { ProgramsService } from '@/programs/programs.service';
import { ApplicationFormType } from './enums/application-form-type.enum';

const FORM_TYPE_DOMAIN_CODE_MAP: Record<ApplicationFormType, DomainCode> = {
  [ApplicationFormType.Partnership]: DomainCode.PsychCenter,
  [ApplicationFormType.ProgramEnrollment]: DomainCode.Academy,
  [ApplicationFormType.EventRegistration]: DomainCode.PsychCenter,
  [ApplicationFormType.CorporateTraining]: DomainCode.PsychCenter,
  [ApplicationFormType.SpecialistRequest]: DomainCode.PsychCenter,
  [ApplicationFormType.Supervision]: DomainCode.PsychCenter,
  [ApplicationFormType.General]: DomainCode.PsychCenter,
};

export const PAYLOAD_TARGET_KEY = {
  [ApplicationFormType.Partnership]: 'personId',
  [ApplicationFormType.ProgramEnrollment]: 'programId',
  [ApplicationFormType.EventRegistration]: 'eventId',
  [ApplicationFormType.CorporateTraining]: 'personId',
  [ApplicationFormType.SpecialistRequest]: 'personId',
  [ApplicationFormType.Supervision]: 'personId',
  [ApplicationFormType.General]: 'personId',
} as const satisfies Record<
  ApplicationFormType,
  'programId' | 'eventId' | 'personId'
>;

export function toApplicationIdString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '_id' in value) {
    const nestedId = (value as { _id?: unknown })._id;
    if (nestedId && nestedId !== value) {
      return toApplicationIdString(nestedId);
    }
  }
  if (
    typeof value === 'object' &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    const stringValue = value.toString();
    return stringValue === '[object Object]' ? undefined : stringValue;
  }
  return undefined;
}

export interface ApplicationSourceContext {
  entityType?: string;
  entityId?: string;
  utm?: Record<string, string>;
}

export interface ApplicationContextInput {
  formType: ApplicationFormType;
  domainId?: string;
  fallbackDomainId?: string;
  source?: ApplicationSourceContext;
  payload?: Record<string, unknown>;
}

export interface ResolvedApplicationContext {
  domainId: string;
  source?: ApplicationSourceContext;
  targetTitle: string | null;
}

@Injectable()
export class ApplicationContextResolver {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly programsService: ProgramsService,
    private readonly eventsService: EventsService,
    private readonly partnersService: PartnersService,
    private readonly peopleService: PeopleService,
  ) {}

  async resolve(
    data: ApplicationContextInput,
  ): Promise<ResolvedApplicationContext> {
    if (data.formType === ApplicationFormType.ProgramEnrollment) {
      const programId = this.requirePayloadTargetId(
        data.payload,
        PAYLOAD_TARGET_KEY[data.formType],
        'Referenced program not found',
      );
      const program = await this.resolvePublicTarget(
        () => this.programsService.findOne(programId),
        'Referenced program not found',
      );
      const domainId = this.requireTargetDomainId(
        program.domainId,
        'Referenced program has no domain',
      );
      this.assertMatchingDomain(data.domainId, domainId);
      await this.domainsService.getActiveById(domainId);
      return {
        domainId,
        source: this.canonicalizeSource(data.source, 'program', programId),
        targetTitle: typeof program.title === 'string' ? program.title : null,
      };
    }

    if (data.formType === ApplicationFormType.EventRegistration) {
      const eventId = this.requirePayloadTargetId(
        data.payload,
        PAYLOAD_TARGET_KEY[data.formType],
        'Referenced event not found',
      );
      const event = await this.resolvePublicTarget(
        () => this.eventsService.findOne(eventId),
        'Referenced event not found',
      );
      const domainId = this.requireTargetDomainId(
        event.domainId,
        'Referenced event has no domain',
      );
      this.assertMatchingDomain(data.domainId, domainId);
      await this.domainsService.getActiveById(domainId);
      return {
        domainId,
        source: this.canonicalizeSource(data.source, 'event', eventId),
        targetTitle: typeof event.title === 'string' ? event.title : null,
      };
    }

    const targetKey = PAYLOAD_TARGET_KEY[data.formType];
    const personId =
      typeof data.payload?.[targetKey] === 'string'
        ? data.payload[targetKey]
        : undefined;
    if (personId) {
      await this.resolvePublicTarget(
        () => this.peopleService.findOne(personId),
        'Referenced person not found',
      );
      const domainId = await this.resolveEffectiveDomainId(data);
      await this.domainsService.getActiveById(domainId);
      return {
        domainId,
        source: this.canonicalizeSource(data.source, 'person', personId),
        targetTitle: null,
      };
    }

    const domainId = await this.resolveEffectiveDomainId(data);
    await this.domainsService.getActiveById(domainId);
    await this.validateEntityReference(
      data.source?.entityType,
      data.source?.entityId,
    );
    return {
      domainId,
      source: data.source,
      targetTitle: null,
    };
  }

  private async resolveEffectiveDomainId(data: {
    formType: ApplicationFormType;
    domainId?: string;
    fallbackDomainId?: string;
  }): Promise<string> {
    if (typeof data.domainId === 'string') return data.domainId;
    if (typeof data.fallbackDomainId === 'string') {
      return data.fallbackDomainId;
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

  private async resolvePublicTarget<T>(
    resolver: () => Promise<T>,
    notFoundMessage: string,
  ): Promise<T> {
    try {
      return await resolver();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(notFoundMessage);
      }
      throw error;
    }
  }

  private requirePayloadTargetId(
    payload: Record<string, unknown> | undefined,
    key: 'programId' | 'eventId',
    errorMessage: string,
  ): string {
    const value = payload?.[key];
    if (typeof value !== 'string') throw new BadRequestException(errorMessage);
    return value;
  }

  private requireTargetDomainId(value: unknown, errorMessage: string): string {
    const domainId = toApplicationIdString(value);
    if (!domainId) throw new BadRequestException(errorMessage);
    return domainId;
  }

  private assertMatchingDomain(
    suppliedDomainId: string | undefined,
    canonicalDomainId: string,
  ): void {
    if (suppliedDomainId && suppliedDomainId !== canonicalDomainId) {
      throw new BadRequestException(
        'Application domainId conflicts with the target entity',
      );
    }
  }

  private canonicalizeSource(
    source: ApplicationSourceContext | undefined,
    entityType: 'program' | 'event' | 'person',
    entityId: string,
  ): ApplicationSourceContext {
    if (
      (source?.entityType && source.entityType !== entityType) ||
      (source?.entityId && source.entityId !== entityId)
    ) {
      throw new BadRequestException(
        'Application source conflicts with the target entity',
      );
    }
    return {
      entityType,
      entityId,
      ...(source?.utm ? { utm: source.utm } : {}),
    };
  }

  private async validateEntityReference(
    entityType?: string,
    entityId?: string,
  ): Promise<void> {
    if (!entityType && !entityId) return;
    if (!entityType || !entityId) {
      throw new BadRequestException(
        'source.entityType and source.entityId must be provided together',
      );
    }
    const exists =
      entityType === 'program'
        ? await this.programsService.exists(entityId)
        : entityType === 'event'
        ? await this.eventsService.exists(entityId)
        : entityType === 'partner'
        ? await this.partnersService.exists(entityId)
        : entityType === 'person'
        ? await this.peopleService.exists(entityId)
        : undefined;
    if (exists === undefined) {
      throw new BadRequestException('Unsupported source entityType');
    }
    if (!exists) {
      throw new BadRequestException(`Referenced ${entityType} not found`);
    }
  }
}
