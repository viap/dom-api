import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
import { BulkResolveResponse } from '@/common/types/bulk-resolve.types';
import {
  prepareBulkIds,
  toBulkResolveResponse,
} from '@/common/utils/bulk-resolve';
import { resolveExistingIds } from '@/common/utils/resolve-ids';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import {
  Application,
  ApplicationDocument,
} from '@/applications/schemas/application.schema';
import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { DomainsService } from '@/domains/domains.service';
import { LocationsService } from '@/locations/locations.service';
import { MediaService } from '@/media/media.service';
import { MediaDocument } from '@/media/schemas/media.schema';
import {
  BlockValidationServices,
  prepareBlocksForWrite,
  PublicBlockServices,
  toPublicBlocks,
} from '@/pages/utils/block-validation';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventStatus } from './enums/event-status.enum';
import { EventQueryParams } from './types/query-params.interface';
import {
  DomainEvent,
  DomainEventDocument,
} from './schemas/domain-event.schema';

const PUBLIC_EVENT_STATUSES: EventStatus[] = [
  EventStatus.Planned,
  EventStatus.RegistrationOpen,
  EventStatus.Ongoing,
  EventStatus.Completed,
  EventStatus.Cancelled,
];

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(DomainEvent.name)
    private eventModel: Model<DomainEventDocument>,
    @InjectModel(Application.name)
    private applicationModel: Model<ApplicationDocument>,
    private domainsService: DomainsService,
    private locationsService: LocationsService,
    private mediaService: MediaService,
    private peopleService: PeopleService,
    private partnersService: PartnersService,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<DomainEventDocument> {
    await this.validateDomainAndRefs(createEventDto);
    await this.ensureUniqueSlug(createEventDto.domainId, createEventDto.slug);

    const normalizedBlocks = createEventDto.blocks?.length
      ? await prepareBlocksForWrite(
          createEventDto.blocks,
          this.getBlockValidationServices(),
        )
      : createEventDto.blocks;

    const event = new this.eventModel({
      ...createEventDto,
      blocks: normalizedBlocks ?? [],
    });
    return event.save();
  }

  async findAll(
    queryParams: EventQueryParams = {},
  ): Promise<DomainEventDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const domainId =
      typeof safeParams.domainId === 'string' ? safeParams.domainId : null;
    if (domainId) {
      await this.domainsService.getActiveById(domainId);
    }

    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
    const query: Record<string, unknown> = {
      status: { $in: PUBLIC_EVENT_STATUSES },
    };
    if (domainId) {
      query.domainId = domainId;
    }
    if (typeof safeParams.personId === 'string') {
      query.$or = [
        { speakerIds: safeParams.personId },
        { organizerIds: safeParams.personId },
      ];
    }

    const events = await this.eventModel
      .find(query)
      .sort({ startAt: 1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    const eventDocuments = events as DomainEventDocument[];
    const eventIds = eventDocuments.map((event) => event._id.toString());
    const [domainSlugById, countsMap, mediaById] = await Promise.all([
      this.resolveDomainSlugsForEvents(eventDocuments),
      this.countRegistrationsByEventIds(eventIds),
      this.resolveEventMediaById(eventDocuments),
    ]);

    return Promise.all(
      events.map((event) => {
        const id = (event as DomainEventDocument)._id.toString();
        const domainId = this.toIdString(
          (event as unknown as Record<string, unknown>).domainId,
        );
        return this.toPublicEvent(
          event as DomainEventDocument,
          countsMap.get(id) ?? 0,
          domainId ? domainSlugById.get(domainId) : undefined,
          mediaById,
        );
      }),
    );
  }

  async findOne(id: string): Promise<DomainEventDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid event ID format');
    }

    const event = await this.eventModel
      .findOne({ _id: validId, status: { $in: PUBLIC_EVENT_STATUSES } })
      .lean()
      .exec();
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const mediaById = await this.resolveEventMediaById([
      event as DomainEventDocument,
    ]);

    return this.toPublicEvent(
      event as DomainEventDocument,
      undefined,
      undefined,
      mediaById,
    );
  }

  async findOneByDomainSlugAndEventSlug(
    domainSlug: string,
    eventSlug: string,
  ): Promise<DomainEventDocument> {
    const domain = await this.domainsService.getActiveBySlug(domainSlug);

    const event = await this.eventModel
      .findOne({
        domainId: domain._id,
        slug: eventSlug,
        status: { $in: PUBLIC_EVENT_STATUSES },
      })
      .lean()
      .exec();
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const mediaById = await this.resolveEventMediaById([
      event as DomainEventDocument,
    ]);

    return this.toPublicEvent(
      event as DomainEventDocument,
      undefined,
      undefined,
      mediaById,
    );
  }

  async findManyByIds(
    ids: string[],
  ): Promise<BulkResolveResponse<DomainEventDocument>> {
    const preparedIds = prepareBulkIds(ids);
    if (!preparedIds.validIds.length) {
      return {
        items: [],
      };
    }

    const events = await this.eventModel
      .find({
        _id: { $in: preparedIds.validIds },
        status: { $in: PUBLIC_EVENT_STATUSES },
      })
      .lean()
      .exec();

    const eventDocuments = events as DomainEventDocument[];
    const eventIds = eventDocuments.map((event) => event._id.toString());
    const [countsMap, mediaById] = await Promise.all([
      this.countRegistrationsByEventIds(eventIds),
      this.resolveEventMediaById(eventDocuments),
    ]);

    const publicEvents = await Promise.all(
      eventDocuments.map((event) =>
        this.toPublicEvent(
          event,
          countsMap.get(event._id.toString()) ?? 0,
          undefined,
          mediaById,
        ),
      ),
    );

    return toBulkResolveResponse({
      preparedIds,
      items: publicEvents,
      getId: (event) => event._id.toString(),
    });
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
  ): Promise<DomainEventDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid event ID format');
    }

    const existingEvent = await this.eventModel.findById(validId).lean().exec();
    if (!existingEvent) {
      throw new NotFoundException('Event not found');
    }

    const domainId =
      updateEventDto.domainId || existingEvent.domainId.toString();
    const slug = updateEventDto.slug || existingEvent.slug;

    await this.validateDomainAndRefs({
      domainId,
      locationId:
        updateEventDto.locationId || existingEvent.locationId?.toString(),
      mediaId: updateEventDto.mediaId || existingEvent.mediaId?.toString(),
      speakerIds:
        updateEventDto.speakerIds ||
        existingEvent.speakerIds.map((id) => id.toString()),
      organizerIds:
        updateEventDto.organizerIds ||
        existingEvent.organizerIds.map((id) => id.toString()),
      partnerIds:
        updateEventDto.partnerIds ||
        existingEvent.partnerIds.map((id) => id.toString()),
    });
    await this.ensureUniqueSlug(domainId, slug, validId);

    const normalizedBlocks =
      updateEventDto.blocks !== undefined
        ? await prepareBlocksForWrite(
            updateEventDto.blocks,
            this.getBlockValidationServices(),
          )
        : undefined;

    const updateData: Record<string, unknown> = { ...updateEventDto };
    if (normalizedBlocks !== undefined) {
      updateData.blocks = normalizedBlocks;
    }

    const event = await this.eventModel
      .findByIdAndUpdate(validId, updateData, {
        new: true,
        runValidators: true,
      })
      .lean()
      .exec();

    return event as DomainEventDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid event ID format');
    }

    const result = await this.eventModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Event not found');
    }

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.eventModel.countDocuments({ _id: validId });
    return count > 0;
  }

  async existingIds(ids: string[]): Promise<Set<string>> {
    return resolveExistingIds(this.eventModel, ids);
  }

  private async toPublicEvent(
    event: DomainEventDocument,
    registeredCount?: number,
    domainSlug?: string,
    mediaById: Map<string, MediaDocument> = new Map(),
  ): Promise<DomainEventDocument> {
    const eventObj = event as unknown as Record<string, unknown>;
    const blocks = Array.isArray(eventObj.blocks)
      ? (eventObj.blocks as Array<Record<string, unknown>>)
      : [];
    const publicBlocks = await toPublicBlocks(
      blocks,
      this.getPublicBlockServices(),
    );

    let count = registeredCount;
    if (count === undefined) {
      const eventId = (eventObj._id as { toString(): string }).toString();
      count = await this.applicationModel.countDocuments({
        formType: ApplicationFormType.EventRegistration,
        'source.entityType': 'event',
        'source.entityId': eventId,
      });
    }

    const mediaId = this.toIdString(eventObj.mediaId);
    const media = mediaId ? mediaById.get(mediaId) : undefined;

    return {
      ...eventObj,
      ...(media ? { mediaId: media } : {}),
      ...(domainSlug ? { domainSlug } : {}),
      blocks: publicBlocks,
      registeredCount: count,
    } as unknown as DomainEventDocument;
  }

  private toIdString(value: unknown): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Types.ObjectId) {
      return value.toString();
    }

    if (
      typeof value === 'object' &&
      'toHexString' in value &&
      typeof value.toHexString === 'function'
    ) {
      return value.toHexString();
    }

    if (typeof value === 'object' && '_id' in value) {
      const id = (value as { _id?: unknown })._id;
      if (id && id !== value) {
        return this.toIdString(id);
      }
    }

    return '';
  }

  private async resolveDomainSlugsForEvents(
    events: DomainEventDocument[],
  ): Promise<Map<string, string>> {
    const domainIds = Array.from(
      new Set(
        events
          .map((event) =>
            this.toIdString(
              (event as unknown as Record<string, unknown>).domainId,
            ),
          )
          .filter(Boolean),
      ),
    );

    if (!domainIds.length) {
      return new Map();
    }

    const domains = await this.domainsService.findManyByIds(domainIds);
    return new Map(
      domains.items.map((domain) => [domain._id.toString(), domain.slug]),
    );
  }

  private async resolveEventMediaById(
    events: DomainEventDocument[],
  ): Promise<Map<string, MediaDocument>> {
    const mediaIds = Array.from(
      new Set(
        events
          .map((event) =>
            this.toIdString(
              (event as unknown as Record<string, unknown>).mediaId,
            ),
          )
          .filter(Boolean),
      ),
    );

    if (!mediaIds.length) {
      return new Map();
    }

    const media = await this.mediaService.findManyByIds(mediaIds);
    return new Map(
      media.items.map((item) => [item._id.toString(), item as MediaDocument]),
    );
  }

  private async countRegistrationsByEventIds(
    eventIds: string[],
  ): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map();

    const results = await this.applicationModel.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          formType: ApplicationFormType.EventRegistration,
          'source.entityType': 'event',
          'source.entityId': {
            $in: eventIds.map((id) => new Types.ObjectId(id)),
          },
        },
      },
      {
        $group: { _id: { $toString: '$source.entityId' }, count: { $sum: 1 } },
      },
    ]);

    const map = new Map<string, number>();
    for (const r of results) {
      map.set(r._id, r.count);
    }
    return map;
  }

  private getBlockValidationServices(): BlockValidationServices {
    return {
      peopleExistingIds: (ids) => this.peopleService.existingIds(ids),
      partnersExistingIds: (ids) => this.partnersService.existingIds(ids),
      eventsExistingIds: (ids) => this.existingIds(ids),
      mediaExistingPublishedIds: (ids) =>
        this.mediaService.existingPublishedIds(ids),
      pagesExistingIds: async (ids) => {
        if (ids.length > 0) {
          throw new BadRequestException(
            'Page button links are not supported in event blocks',
          );
        }
        return new Set<string>();
      },
      domainsGetActiveById: (id) => this.domainsService.getActiveById(id),
    };
  }

  private getPublicBlockServices(): PublicBlockServices {
    return {
      findPublishedPeopleSummariesByIds: (ids) =>
        this.peopleService.findPublishedSummariesByIds(ids),
    };
  }

  private async validateDomainAndRefs(data: {
    domainId: string;
    locationId?: string;
    mediaId?: string;
    speakerIds?: string[];
    organizerIds?: string[];
    partnerIds?: string[];
  }): Promise<void> {
    await this.domainsService.getActiveById(data.domainId);

    if (data.locationId) {
      const exists = await this.locationsService.exists(data.locationId);
      if (!exists) {
        throw new BadRequestException('Referenced location not found');
      }
    }

    if (data.mediaId) {
      const mediaExists = await this.mediaService.existsPublished(data.mediaId);
      if (!mediaExists) {
        throw new BadRequestException('Referenced published media not found');
      }
    }

    await this.validatePeople(data.speakerIds || []);
    await this.validatePeople(data.organizerIds || []);
    await this.validatePartners(data.partnerIds || []);
  }

  private async validatePeople(ids: string[]): Promise<void> {
    for (const id of ids) {
      const exists = await this.peopleService.exists(id);
      if (!exists) {
        throw new BadRequestException(`Referenced person not found: ${id}`);
      }
    }
  }

  private async validatePartners(ids: string[]): Promise<void> {
    for (const id of ids) {
      const exists = await this.partnersService.exists(id);
      if (!exists) {
        throw new BadRequestException(`Referenced partner not found: ${id}`);
      }
    }
  }

  private async ensureUniqueSlug(
    domainId: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = { domainId, slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.eventModel.findOne(query);
    if (existing) {
      throw new ConflictException(
        'Event with this slug already exists in the domain',
      );
    }
  }
}
