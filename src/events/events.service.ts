import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  findRanked,
  RandomOrdering,
  RandomScanUnavailableException,
} from '@/common/utils/ranked-query';
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
import { formatMongooseUpdateValidationError } from '@/common/utils/mongoose-validation-error';
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
import { LocationDocument } from '@/locations/schemas/location.schema';
import { MediaService } from '@/media/media.service';
import { MediaDocument } from '@/media/schemas/media.schema';
import {
  BlockValidationServices,
  prepareBlocksForWrite,
  PublicBlockServices,
  toPublicBlocks,
  PublicBlockConversionPolicy,
} from '@/pages/utils/block-validation';
import {
  canonicalFilters,
  publicRandomSelections,
} from '@/pages/utils/random-selection-cache';
import { orderBucket } from '@/pages/utils/entity-collection-ordering';
import { PersistedCollectionIdentity } from '@/pages/types/page-block.interface';
import { preserveOmittedHtmlSnippets } from '@/pages/utils/html-snippet-preservation';
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
import {
  addEventCalendarDays,
  EventScheduleValidationError,
  eventDateToUtcStartIsoString,
  eventDateTimeToLocalKey,
  hasActiveOccurrenceInRange,
  isRecurringSchedule,
  normalizeEventSchedule,
  projectEventScheduleForRead,
} from './utils/event-schedule';
import { EVENT_SCHEDULE_ADMIN_PREVIEW_LIMIT } from './types/event-schedule.interface';
import { EventCollectionContext } from '@/events/types/entity-collection-filters.interface';
import { EventEntityCollectionFilters } from './types/entity-collection-filters.interface';
import {
  buildCapacityUpdate,
  readCapacityDiagnostic,
} from './utils/event-capacity';
import {
  isPublicEventLifecycle,
  normalizeEffectiveLifecycle,
} from './utils/event-lifecycle';
import {
  getEventNextTransitionAt,
  getRegistrationAvailability,
} from './utils/event-policy';
import { PublicEventDto } from './types/public-event.interface';

const PUBLIC_EVENT_STATUSES: EventStatus[] = [
  EventStatus.Active,
  EventStatus.Planned,
  EventStatus.RegistrationOpen,
  EventStatus.Ongoing,
  EventStatus.Completed,
  EventStatus.Cancelled,
];
const ACTIVE_EVENT_STATUSES: EventStatus[] = [
  EventStatus.Active,
  EventStatus.Planned,
  EventStatus.RegistrationOpen,
  EventStatus.Ongoing,
];
const EVENT_SNAPSHOT_CANDIDATE_LIMIT = 1000;

type PublicEventLocation = Pick<
  LocationDocument,
  '_id' | 'title' | 'address' | 'city' | 'country' | 'geo'
>;

function hasOwnProperty(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

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
    const createData = this.prepareCreateTiming(createEventDto);

    await this.validateDomainAndRefs(createData);
    await this.ensureUniqueSlug(createData.domainId, createData.slug);

    const normalizedBlocks = createData.blocks?.length
      ? await prepareBlocksForWrite(
          createData.blocks,
          this.getBlockValidationServices(),
          { kind: 'event' },
        )
      : createData.blocks;

    const event = new this.eventModel({
      ...createData,
      blocks: normalizedBlocks ?? [],
    });
    const saved = await event.save();
    const savedObject =
      typeof saved.toObject === 'function' ? saved.toObject() : saved;
    return this.toReadEvent(savedObject as DomainEventDocument);
  }

  async findAll(
    queryParams: EventQueryParams = {},
    signal?: AbortSignal,
  ): Promise<PublicEventDto[]> {
    const snapshotNow = new Date();
    await this.reconcileExpiredNonRecurring(snapshotNow);
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
    const [domainSlugById, countsMap, mediaById, locationById] =
      await Promise.all([
        this.resolveDomainSlugsForEvents(eventDocuments),
        this.countRegistrationsByEventIds(eventIds),
        this.resolveEventMediaById(eventDocuments),
        this.resolveEventLocationsById(eventDocuments),
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
          locationById,
          { dynamicRandom: 'default' },
          signal,
          snapshotNow,
        );
      }),
    );
  }

  async findOne(id: string, signal?: AbortSignal): Promise<PublicEventDto> {
    const snapshotNow = new Date();
    await this.reconcileExpiredNonRecurring(snapshotNow, id);
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

    const eventDocuments = [event as DomainEventDocument];
    const [count, mediaById, locationById] = await Promise.all([
      this.countRegistrationsByEventIds([validId]).then(
        (counts) => counts.get(validId) ?? 0,
      ),
      this.resolveEventMediaById(eventDocuments),
      this.resolveEventLocationsById(eventDocuments),
    ]);

    return this.toPublicEvent(
      event as DomainEventDocument,
      count,
      undefined,
      mediaById,
      locationById,
      undefined,
      signal,
      snapshotNow,
    );
  }

  async findOneByDomainSlugAndEventSlug(
    domainSlug: string,
    eventSlug: string,
    signal?: AbortSignal,
  ): Promise<PublicEventDto> {
    const snapshotNow = new Date();
    await this.reconcileExpiredNonRecurring(snapshotNow);
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

    const eventDocuments = [event as DomainEventDocument];
    const eventId = (event as DomainEventDocument)._id.toString();
    const [count, mediaById, locationById] = await Promise.all([
      this.countRegistrationsByEventIds([eventId]).then(
        (counts) => counts.get(eventId) ?? 0,
      ),
      this.resolveEventMediaById(eventDocuments),
      this.resolveEventLocationsById(eventDocuments),
    ]);

    return this.toPublicEvent(
      event as DomainEventDocument,
      count,
      undefined,
      mediaById,
      locationById,
      undefined,
      signal,
      snapshotNow,
    );
  }

  async findManyByIds(
    ids: string[],
    signal?: AbortSignal,
  ): Promise<BulkResolveResponse<PublicEventDto>> {
    const snapshotNow = new Date();
    await this.reconcileExpiredNonRecurring(snapshotNow);
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
    const [countsMap, mediaById, locationById] = await Promise.all([
      this.countRegistrationsByEventIds(eventIds),
      this.resolveEventMediaById(eventDocuments),
      this.resolveEventLocationsById(eventDocuments),
    ]);

    const publicEvents = await Promise.all(
      eventDocuments.map((event) =>
        this.toPublicEvent(
          event,
          countsMap.get(event._id.toString()) ?? 0,
          undefined,
          mediaById,
          locationById,
          { dynamicRandom: 'default' },
          signal,
          snapshotNow,
        ),
      ),
    );

    return toBulkResolveResponse({
      preparedIds,
      items: publicEvents,
      getId: (event) => event._id.toString(),
    });
  }

  async findManyAdminByIds(
    ids: string[],
  ): Promise<BulkResolveResponse<DomainEventDocument>> {
    const snapshotNow = new Date();
    await this.reconcileExpiredNonRecurring(snapshotNow);
    const preparedIds = prepareBulkIds(ids);
    if (!preparedIds.validIds.length) {
      return {
        items: [],
      };
    }

    const events = await this.eventModel
      .find({
        _id: { $in: preparedIds.validIds },
      })
      .lean()
      .exec();

    const counts = await this.countRegistrationsByEventIds(
      (events as DomainEventDocument[]).map((event) => event._id.toString()),
    );
    return toBulkResolveResponse({
      preparedIds,
      items: (events as DomainEventDocument[]).map((event) =>
        this.toAdminEvent(
          event,
          counts.get(event._id.toString()) ?? 0,
          snapshotNow,
        ),
      ),
      getId: (event) => event._id.toString(),
    });
  }

  async findAllAdmin(
    queryParams: EventQueryParams = {},
  ): Promise<DomainEventDocument[]> {
    const snapshotNow = new Date();
    await this.reconcileExpiredNonRecurring(snapshotNow);
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
    const query: Record<string, unknown> = {};
    if (typeof safeParams.domainId === 'string') {
      await this.domainsService.getActiveById(safeParams.domainId);
      query.domainId = safeParams.domainId;
    }
    const events = (await this.eventModel
      .find(query)
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec()) as DomainEventDocument[];
    const counts = await this.countRegistrationsByEventIds(
      events.map((event) => event._id.toString()),
    );
    return events.map((event) =>
      this.toAdminEvent(
        event,
        counts.get(event._id.toString()) ?? 0,
        snapshotNow,
      ),
    );
  }

  async assertRegistrationAvailable(id: string): Promise<DomainEventDocument> {
    const now = new Date();
    await this.reconcileExpiredNonRecurring(now, id);
    const validId = validateObjectId(id);
    if (!validId) throw new NotFoundException('Event not found');
    const event = await this.eventModel.findById(validId).lean().exec();
    if (!event || !isPublicEventLifecycle(event.status)) {
      throw new NotFoundException('Event not found');
    }
    const counts = await this.countRegistrationsByEventIds([validId]);
    const availability = getRegistrationAvailability({
      event: event as DomainEventDocument,
      registeredCount: counts.get(validId) ?? 0,
      now,
    });
    if (availability === 'closed') {
      throw new BadRequestException('Event registration is closed');
    }
    return event as DomainEventDocument;
  }

  async findManyPublicByIdsAt(
    ids: string[],
    snapshotNow: Date,
    signal?: AbortSignal,
  ): Promise<PublicEventDto[]> {
    const preparedIds = prepareBulkIds(ids);
    if (!preparedIds.validIds.length) return [];
    const events = (await this.eventModel
      .find({
        _id: { $in: preparedIds.validIds },
        status: { $in: PUBLIC_EVENT_STATUSES },
      })
      .lean()
      .exec()) as DomainEventDocument[];
    const counts = await this.countRegistrationsByEventIds(
      events.map((event) => event._id.toString()),
    );
    const [mediaById, locationById] = await Promise.all([
      this.resolveEventMediaById(events),
      this.resolveEventLocationsById(events),
    ]);
    const byId = new Map(
      await Promise.all(
        events.map(
          async (event) =>
            [
              event._id.toString(),
              await this.toPublicEvent(
                event,
                counts.get(event._id.toString()) ?? 0,
                undefined,
                mediaById,
                locationById,
                { dynamicRandom: 'default' },
                signal,
                snapshotNow,
              ),
            ] as const,
        ),
      ),
    );
    return preparedIds.uniqueIds
      .map((id) => byId.get(preparedIds.validIdByInput.get(id) ?? ''))
      .filter((event): event is PublicEventDto => Boolean(event));
  }

  async findTransitionBoundariesByIdsAt(
    ids: string[],
    snapshotNow: Date,
  ): Promise<string[]> {
    const preparedIds = prepareBulkIds(ids);
    if (!preparedIds.validIds.length) return [];
    const events = (await this.eventModel
      .find({
        _id: { $in: preparedIds.validIds },
        status: { $in: PUBLIC_EVENT_STATUSES },
      })
      .select({ status: 1, schedule: 1, startAt: 1, endAt: 1, registration: 1 })
      .lean()
      .exec()) as DomainEventDocument[];
    return events
      .map((event) => getEventNextTransitionAt(event, snapshotNow))
      .filter((value): value is string => Boolean(value));
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
  ): Promise<DomainEventDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid event ID format');
    }

    const now = new Date();
    await this.reconcileExpiredNonRecurring(now, validId);
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
            preserveOmittedHtmlSnippets(
              updateEventDto.blocks,
              Array.isArray(existingEvent.blocks) ? existingEvent.blocks : [],
            ),
            this.getBlockValidationServices(),
            { kind: 'event' },
          )
        : undefined;

    const directCapacityPresent = hasOwnProperty(updateEventDto, 'capacity');
    const capacityUpdate = buildCapacityUpdate({
      event: existingEvent,
      mutation: updateEventDto.capacityMutation,
      directCapacityPresent,
      directCapacity: updateEventDto.capacity,
    });
    const timingDto = { ...updateEventDto };
    delete timingDto.expectedRevision;
    delete timingDto.capacityMutation;
    delete timingDto.capacity;
    if (timingDto.registration !== undefined) {
      const incomingRegistration = { ...timingDto.registration };
      if (hasOwnProperty(incomingRegistration, 'maxParticipants')) {
        if (
          incomingRegistration.maxParticipants !==
          existingEvent.registration?.maxParticipants
        ) {
          throw new ConflictException('CAPACITY_CONFLICT');
        }
        delete incomingRegistration.maxParticipants;
      }
      timingDto.registration = {
        ...incomingRegistration,
        ...(capacityUpdate === null &&
        existingEvent.registration?.maxParticipants !== undefined
          ? {
              maxParticipants: existingEvent.registration.maxParticipants,
            }
          : {}),
      };
    }
    const updateData: Record<string, unknown> = this.prepareUpdateTiming(
      timingDto,
      existingEvent as DomainEventDocument,
    );
    if (normalizedBlocks !== undefined) {
      updateData.blocks = normalizedBlocks;
    }

    const unsetData: Record<string, 1> = {};
    if (capacityUpdate?.clear) {
      unsetData.capacity = 1;
      if (updateData.registration === undefined) {
        unsetData['registration.maxParticipants'] = 1;
      }
    } else if (capacityUpdate?.set !== undefined) {
      updateData.capacity = capacityUpdate.set;
      if (updateData.registration === undefined) {
        unsetData['registration.maxParticipants'] = 1;
      }
    }

    const hasExpectedRevision = hasOwnProperty(
      updateEventDto,
      'expectedRevision',
    );
    if (updateEventDto.capacityMutation && !hasExpectedRevision) {
      throw new ConflictException('CAPACITY_CONFLICT');
    }
    const revisionPredicate = hasExpectedRevision
      ? updateEventDto.expectedRevision === null
        ? { __v: { $exists: false } }
        : { __v: updateEventDto.expectedRevision }
      : existingEvent.__v === undefined
      ? { __v: { $exists: false } }
      : { __v: existingEvent.__v };
    let event: unknown;
    try {
      event = await this.eventModel
        .findOneAndUpdate(
          { _id: validId, ...revisionPredicate },
          {
            $set: updateData,
            ...(Object.keys(unsetData).length ? { $unset: unsetData } : {}),
            $inc: { __v: 1 },
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .lean()
        .exec();
    } catch (error) {
      const message = formatMongooseUpdateValidationError(error);
      if (message) {
        throw new BadRequestException(message);
      }
      throw error;
    }

    if (!event) {
      throw new ConflictException(
        'Event changed while it was being edited; reload and try again',
      );
    }

    return this.toReadEvent(event as DomainEventDocument);
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

  async getNotificationTitle(id: string): Promise<string | null> {
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }

    const event = await this.eventModel
      .findById(validId)
      .select({ title: 1 })
      .lean()
      .exec();

    return typeof event?.title === 'string' ? event.title : null;
  }

  async existingIds(ids: string[]): Promise<Set<string>> {
    return resolveExistingIds(this.eventModel, ids);
  }

  async findDynamicSummaries(
    filters: EventEntityCollectionFilters,
    limit: number,
    context: EventCollectionContext,
    signal?: AbortSignal,
  ): Promise<Array<{ id: string; label: string }>> {
    signal?.throwIfAborted();
    const domainIds = context.domainId
      ? [context.domainId]
      : (await this.domainsService.findAll()).map((domain) =>
          domain._id.toString(),
        );
    signal?.throwIfAborted();
    if (!domainIds.length) return [];

    const query = this.buildDynamicSummaryQuery(filters, domainIds);
    const temporal = filters.temporal;
    this.applyTemporalFilter(query, filters, context.now);
    const exactPredicate = this.getExactTemporalPredicate(filters);
    if (context.ordering || temporal) {
      return this.findDynamicSummaryQuery(
        query,
        { startAt: temporal?.mode === 'past' ? -1 : 1, title: 1, _id: 1 },
        limit,
        context.ordering,
        signal,
        exactPredicate,
      );
    }

    const upcomingQuery = { ...query };
    this.applyTemporalFilter(
      upcomingQuery,
      { ...filters, temporal: { mode: 'upcoming' } },
      context.now,
    );
    const upcoming = await this.findDynamicSummaryQuery(
      upcomingQuery,
      { startAt: 1, title: 1, _id: 1 },
      limit,
      undefined,
      signal,
    );
    if (upcoming.length >= limit) return upcoming;
    const pastQuery = { ...query };
    this.applyTemporalFilter(
      pastQuery,
      { ...filters, temporal: { mode: 'past' } },
      context.now,
    );
    const past = await this.findDynamicSummaryQuery(
      pastQuery,
      { startAt: -1, title: 1, _id: 1 },
      limit - upcoming.length,
      undefined,
      signal,
    );
    return [...upcoming, ...past];
  }

  async findDynamicPreviewItems(
    filters: EventEntityCollectionFilters,
    limit: number,
    context: EventCollectionContext,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    const domainIds = context.domainId
      ? [context.domainId]
      : (await this.domainsService.findAll()).map((domain) =>
          domain._id.toString(),
        );
    signal?.throwIfAborted();
    if (!domainIds.length) return [];

    const query = this.buildDynamicSummaryQuery(filters, domainIds);
    const temporal = filters.temporal;
    let events;
    this.applyTemporalFilter(query, filters, context.now);
    const exactPredicate = this.getExactTemporalPredicate(filters);
    if (context.ordering || temporal) {
      events = await this.findDynamicPreviewQuery(
        query,
        { startAt: temporal?.mode === 'past' ? -1 : 1, title: 1, _id: 1 },
        limit,
        context.ordering,
        signal,
        exactPredicate,
      );
    } else {
      const upcomingQuery = { ...query };
      this.applyTemporalFilter(
        upcomingQuery,
        { ...filters, temporal: { mode: 'upcoming' } },
        context.now,
      );
      const upcoming = await this.findDynamicPreviewQuery(
        upcomingQuery,
        { startAt: 1, title: 1, _id: 1 },
        limit,
        undefined,
        signal,
      );
      events =
        upcoming.length >= limit
          ? upcoming
          : [
              ...upcoming,
              ...(await (() => {
                const pastQuery = { ...query };
                this.applyTemporalFilter(
                  pastQuery,
                  { ...filters, temporal: { mode: 'past' } },
                  context.now,
                );
                return this.findDynamicPreviewQuery(
                  pastQuery,
                  { startAt: -1, title: 1, _id: 1 },
                  limit - upcoming.length,
                  undefined,
                  signal,
                );
              })()),
            ];
    }

    signal?.throwIfAborted();
    const locationTitles = await this.resolveLocationTitles(
      events.map((event) => event.locationId),
    );
    signal?.throwIfAborted();
    return events.map((event) => {
      const locationTitle = event.locationId
        ? locationTitles.get(event.locationId.toString())
        : undefined;
      return {
        id: event._id.toString(),
        label: event.title,
        metadata: {
          eventType: event.type,
          startAt: event.startAt,
          endAt: event.endAt,
          ...(event.schedule
            ? {
                schedule: projectEventScheduleForRead(
                  event.schedule,
                  event.status,
                  context.now,
                ),
              }
            : {}),
          ...(locationTitle ? { locationTitle } : {}),
        },
      };
    });
  }

  async findDynamicSnapshotCandidateIds(
    filters: EventEntityCollectionFilters,
    limit: number,
    context: EventCollectionContext,
    signal?: AbortSignal,
    identity?: PersistedCollectionIdentity,
  ): Promise<{ selectedIds: string[]; candidateIds: string[] }> {
    const loadSelected = async (ordering?: RandomOrdering) => {
      const selectionContext =
        ordering === context.ordering ? context : { ...context, ordering };
      return (
        await this.findDynamicSummaries(
          filters,
          limit,
          selectionContext,
          // Random work is shared by publicRandomSelections. Attaching one
          // request's cancellation would reject the shared promise for every
          // waiter. Direct/Default fallback work remains request-cancellable.
          ordering ? undefined : signal,
        )
      ).map((item) => item.id);
    };
    let selectedIds: string[];
    if (!context.ordering) {
      selectedIds = await loadSelected();
    } else {
      try {
        selectedIds = await publicRandomSelections.resolve(
          JSON.stringify([
            'id-rank-v2',
            context.ordering.seed,
            'events',
            canonicalFilters(filters),
            context.domainId?.toLowerCase() ?? null,
            limit,
          ]),
          orderBucket(context.now),
          (scanStarted) => {
            scanStarted();
            return loadSelected(context.ordering);
          },
        );
      } catch (error) {
        if (!(error instanceof RandomScanUnavailableException)) throw error;
        this.logger.warn({
          event: 'random_default_fallback',
          reason: error.reason,
          ...(identity
            ? { owner: identity.owner, blockPath: identity.blockPath }
            : {}),
          entityType: 'events',
        });
        selectedIds = await loadSelected();
      }
    }
    signal?.throwIfAborted();
    const domainIds = context.domainId
      ? [context.domainId]
      : (await this.domainsService.findAll()).map((domain) =>
          domain._id.toString(),
        );
    signal?.throwIfAborted();
    if (!domainIds.length) {
      return { selectedIds: [], candidateIds: [] };
    }
    const query = this.buildDynamicSummaryQuery(filters, domainIds);
    this.appendQueryAnd(query, {
      $or: [
        {
          'schedule.mode': { $ne: 'recurring' },
          endAt: { $gt: context.now.toISOString() },
        },
        {
          'schedule.mode': 'recurring',
          status: { $in: ACTIVE_EVENT_STATUSES },
          'schedule.hasActiveOccurrences': true,
          $or: [
            { 'schedule.recurrence.endDate': { $exists: false } },
            { endAt: { $gt: context.now.toISOString() } },
          ],
        },
      ],
    });
    const candidates = (await this.eventModel
      .find(query)
      .select({ _id: 1, status: 1, schedule: 1, startAt: 1, endAt: 1 })
      .limit(EVENT_SNAPSHOT_CANDIDATE_LIMIT + 1)
      .lean()
      .exec()) as DomainEventDocument[];
    if (candidates.length > EVENT_SNAPSHOT_CANDIDATE_LIMIT) {
      this.logger.warn(
        JSON.stringify({
          event: 'event_snapshot_candidate_overflow',
          limit: EVENT_SNAPSHOT_CANDIDATE_LIMIT,
          domainId: context.domainId,
          temporalMode: filters.temporal?.mode,
        }),
      );
      throw new ServiceUnavailableException(
        'Event collection snapshot candidate limit exceeded',
      );
    }
    const exact = this.getExactTemporalPredicate(filters);
    return {
      selectedIds,
      candidateIds: [
        ...new Set([
          ...selectedIds,
          ...candidates
            .filter((event) => !exact || exact(event))
            .map((event) => event._id.toString()),
        ]),
      ],
    };
  }

  private applyTemporalFilter(
    query: FilterQuery<DomainEventDocument>,
    filters: EventEntityCollectionFilters,
    now: Date,
  ): void {
    const temporal = filters.temporal;
    if (temporal?.mode === 'upcoming') {
      this.appendQueryAnd(query, {
        $or: [
          {
            'schedule.mode': { $ne: 'recurring' },
            endAt: { $gte: now.toISOString() },
          },
          {
            'schedule.mode': 'recurring',
            status: { $in: ACTIVE_EVENT_STATUSES },
            'schedule.hasActiveOccurrences': true,
            $or: [
              { 'schedule.recurrence.endDate': { $exists: false } },
              {
                'schedule.recurrence.endDate': { $exists: true },
                endAt: { $gte: now.toISOString() },
              },
            ],
          },
        ],
      });
    } else if (temporal?.mode === 'past') {
      const today = eventDateTimeToLocalKey(now).date;
      this.appendQueryAnd(query, {
        $or: [
          {
            'schedule.mode': { $ne: 'recurring' },
            endAt: { $lt: now.toISOString() },
          },
          {
            'schedule.mode': 'recurring',
            status: EventStatus.Completed,
          },
          {
            'schedule.mode': 'recurring',
            'schedule.hasActiveOccurrences': true,
            'schedule.recurrence.endDate': { $exists: true },
            endAt: { $lt: now.toISOString() },
          },
          {
            'schedule.mode': 'recurring',
            'schedule.hasActiveOccurrences': false,
            'schedule.recurrence.endDate': { $lt: today },
          },
        ],
      });
    } else if (temporal?.mode === 'custom') {
      const manualRange: FilterQuery<DomainEventDocument> = {
        'schedule.mode': { $ne: 'recurring' },
      };
      if (temporal.from) {
        manualRange.endAt = {
          $gte: eventDateToUtcStartIsoString(temporal.from),
        };
      }
      if (temporal.to) {
        const nextDate = addEventCalendarDays(temporal.to, 1);
        manualRange.startAt = {
          $lt: eventDateToUtcStartIsoString(nextDate),
        };
      }
      const recurringRange: FilterQuery<DomainEventDocument> = {
        'schedule.mode': 'recurring',
        status: { $in: ACTIVE_EVENT_STATUSES },
        'schedule.hasActiveOccurrences': true,
      };
      if (temporal.to) {
        recurringRange['schedule.recurrence.anchorDate'] = {
          $lte: temporal.to,
        };
      }
      if (temporal.from) {
        recurringRange.$or = [
          { 'schedule.recurrence.endDate': { $exists: false } },
          { 'schedule.recurrence.endDate': { $gte: temporal.from } },
        ];
      }
      this.appendQueryAnd(query, { $or: [manualRange, recurringRange] });
    }
  }

  private appendQueryAnd(
    query: FilterQuery<DomainEventDocument>,
    condition: FilterQuery<DomainEventDocument>,
  ): void {
    const existing = Array.isArray(query.$and) ? query.$and : [];
    query.$and = [...existing, condition];
  }

  private getExactTemporalPredicate(
    filters: EventEntityCollectionFilters,
  ): ((event: DomainEventDocument) => boolean) | undefined {
    const temporal = filters.temporal;
    if (temporal?.mode !== 'custom') return undefined;
    return (event) =>
      hasActiveOccurrenceInRange(
        event.schedule,
        event.status,
        temporal.from,
        temporal.to,
      );
  }

  private buildDynamicSummaryQuery(
    filters: EventEntityCollectionFilters,
    domainIds: string[],
  ): FilterQuery<DomainEventDocument> {
    const query: FilterQuery<DomainEventDocument> = {
      domainId: { $in: domainIds },
      status: {
        $in:
          filters.lifecycle === 'active'
            ? ACTIVE_EVENT_STATUSES
            : PUBLIC_EVENT_STATUSES,
      },
    };
    if (filters.types?.length) query.type = { $in: filters.types };
    if (filters.locationIds?.length)
      query.locationId = { $in: filters.locationIds };
    if (filters.peopleIds?.length) {
      query.$or = [
        { speakerIds: { $in: filters.peopleIds } },
        { organizerIds: { $in: filters.peopleIds } },
      ];
    }
    return query;
  }

  private async findDynamicSummaryQuery(
    query: FilterQuery<DomainEventDocument>,
    sort: Record<string, 1 | -1>,
    limit: number,
    ordering?: RandomOrdering,
    signal?: AbortSignal,
    predicate?: (event: DomainEventDocument) => boolean,
  ): Promise<Array<{ id: string; label: string }>> {
    const events = await findRanked(
      this.eventModel,
      query,
      {
        _id: 1,
        title: 1,
        status: 1,
        startAt: 1,
        endAt: 1,
        schedule: 1,
      },
      sort,
      limit,
      ordering,
      'public',
      signal,
      predicate,
    );
    return events.map((event) => ({
      id: event._id.toString(),
      label: event.title,
    }));
  }

  private findDynamicPreviewQuery(
    query: FilterQuery<DomainEventDocument>,
    sort: Record<string, 1 | -1>,
    limit: number,
    ordering?: RandomOrdering,
    signal?: AbortSignal,
    predicate?: (event: DomainEventDocument) => boolean,
  ) {
    return findRanked(
      this.eventModel,
      query,
      {
        _id: 1,
        title: 1,
        type: 1,
        startAt: 1,
        endAt: 1,
        status: 1,
        schedule: 1,
        locationId: 1,
      },
      sort,
      limit,
      ordering,
      'preview',
      signal,
      predicate,
    );
  }

  private async resolveLocationTitles(
    locationIds: Array<{ toString(): string } | undefined>,
  ) {
    const ids = [
      ...new Set(
        locationIds
          .filter((id): id is { toString(): string } => Boolean(id))
          .map((id) => id.toString()),
      ),
    ];
    if (!ids.length) return new Map<string, string>();

    try {
      const { items } = await this.locationsService.findManyByIds(ids);
      const titles = new Map<string, string>();
      items.forEach((location) => {
        const title = location.title.trim();
        if (title) titles.set(location._id.toString(), title);
      });
      return titles;
    } catch {
      return new Map<string, string>();
    }
  }

  private async toPublicEvent(
    event: DomainEventDocument,
    registeredCount?: number,
    domainSlug?: string,
    mediaById: Map<string, MediaDocument> = new Map(),
    locationById: Map<string, PublicEventLocation> = new Map(),
    policy: PublicBlockConversionPolicy = { dynamicRandom: 'enabled' },
    signal?: AbortSignal,
    snapshotNow = new Date(),
  ): Promise<PublicEventDto> {
    const eventObj = event as unknown as Record<string, unknown>;
    const blocks = Array.isArray(eventObj.blocks)
      ? (eventObj.blocks as Array<Record<string, unknown>>)
      : [];
    const publicBlocks = await toPublicBlocks(
      blocks,
      this.getPublicBlockServices(),
      {
        owner: { kind: 'event', eventId: String(eventObj._id) },
        domainId: this.toIdString(eventObj.domainId),
        now: snapshotNow,
        signal,
      },
      policy,
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
    const locationId = this.toIdString(eventObj.locationId);
    const location = locationId ? locationById.get(locationId) : undefined;

    const readEvent = this.toReadEvent(
      {
        ...eventObj,
        ...(media ? { mediaId: media } : {}),
        ...(location ? { locationId: location } : {}),
        ...(domainSlug ? { domainSlug } : {}),
        blocks: publicBlocks,
      } as unknown as DomainEventDocument,
      snapshotNow,
      2,
      false,
    );
    const lifecycle = normalizeEffectiveLifecycle(readEvent.status);
    const availability = getRegistrationAvailability({
      event: readEvent,
      registeredCount: count,
      now: snapshotNow,
    });
    const diagnostic = readCapacityDiagnostic(readEvent);
    const registration = readEvent.registration
      ? {
          isOpen: readEvent.registration.isOpen,
          ...(readEvent.registration.deadline
            ? { deadline: readEvent.registration.deadline }
            : {}),
        }
      : undefined;
    const publicEvent = {
      ...(readEvent as unknown as Record<string, unknown>),
      status: lifecycle,
      ...(diagnostic.effectiveCapacity !== undefined
        ? { capacity: diagnostic.effectiveCapacity }
        : {}),
      ...(registration ? { registration } : {}),
      registrationAvailability: availability,
      evaluatedAt: snapshotNow.toISOString(),
      ...(getEventNextTransitionAt(readEvent, snapshotNow)
        ? { nextTransitionAt: getEventNextTransitionAt(readEvent, snapshotNow) }
        : {}),
    } as Record<string, unknown>;
    delete publicEvent.capacity;
    if (diagnostic.effectiveCapacity !== undefined) {
      publicEvent.capacity = diagnostic.effectiveCapacity;
    }
    delete publicEvent.registeredCount;
    delete publicEvent.legacyStatus;
    delete publicEvent.capacityConflict;
    delete publicEvent.capacityInvalid;
    delete publicEvent.__v;
    return publicEvent as PublicEventDto;
  }

  private toReadEvent(
    event: DomainEventDocument,
    now = new Date(),
    previewLimit = EVENT_SCHEDULE_ADMIN_PREVIEW_LIMIT,
    includeCancelled = true,
  ): DomainEventDocument {
    const value = event as unknown as Record<string, unknown>;
    const schedule = projectEventScheduleForRead(
      value.schedule as DomainEventDocument['schedule'],
      value.status as EventStatus,
      now,
      previewLimit,
      includeCancelled,
    );
    return {
      ...value,
      ...(schedule ? { schedule } : {}),
    } as unknown as DomainEventDocument;
  }

  private toAdminEvent(
    event: DomainEventDocument,
    registeredCount: number,
    now: Date,
  ): DomainEventDocument {
    const value = event as unknown as Record<string, unknown>;
    const lifecycle = normalizeEffectiveLifecycle(value.status);
    const capacity = readCapacityDiagnostic(event);
    return {
      ...value,
      status: lifecycle === 'invalid' ? value.status : lifecycle,
      ...(lifecycle !== value.status ? { legacyStatus: value.status } : {}),
      ...(capacity.conflict ? { capacityConflict: capacity.conflict } : {}),
      capacityInvalid: capacity.invalid,
      registeredCount,
      schedule: projectEventScheduleForRead(
        event.schedule,
        event.status,
        now,
        EVENT_SCHEDULE_ADMIN_PREVIEW_LIMIT,
      ),
    } as unknown as DomainEventDocument;
  }

  async reconcileExpiredNonRecurring(
    now = new Date(),
    id?: string,
  ): Promise<void> {
    const query: FilterQuery<DomainEventDocument> = {
      status: { $in: ACTIVE_EVENT_STATUSES },
      'schedule.mode': { $ne: 'recurring' },
      endAt: { $lte: now.toISOString() },
    };
    if (id) {
      const validId = validateObjectId(id);
      if (!validId) return;
      query._id = validId;
    }
    await this.eventModel.updateMany(
      query,
      {
        $set: { status: EventStatus.Completed },
        $inc: { __v: 1 },
      },
      // Reconciliation is a lifecycle transition, not an editorial update.
      // Keep the admin list's updatedAt ordering stable while the revision still
      // advances so concurrent CAS writers observe the transition.
      { timestamps: false },
    );
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

  private async resolveEventLocationsById(
    events: DomainEventDocument[],
  ): Promise<Map<string, PublicEventLocation>> {
    const locationIds = Array.from(
      new Set(
        events
          .map((event) =>
            this.toIdString(
              (event as unknown as Record<string, unknown>).locationId,
            ),
          )
          .filter(Boolean),
      ),
    );

    if (!locationIds.length) {
      return new Map();
    }

    const locations = await this.locationsService.findManyByIds(locationIds);
    return new Map(
      locations.items.map((location) => [
        location._id.toString(),
        this.toPublicEventLocation(location),
      ]),
    );
  }

  private toPublicEventLocation(
    location: LocationDocument,
  ): PublicEventLocation {
    const { _id, title, address, city, country, geo } = location;

    return {
      _id,
      title,
      address,
      ...(city ? { city } : {}),
      ...(country ? { country } : {}),
      ...(geo ? { geo } : {}),
    };
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
      findDynamicPeopleSummaries: (filters, limit, ordering) =>
        this.peopleService.findDynamicSummaries(filters, limit, ordering),
      findDynamicPartnerSummaries: (filters, limit, ordering) =>
        this.partnersService.findDynamicSummaries(filters, limit, ordering),
      findDynamicEventSummaries: (filters, limit, context, signal) =>
        this.findDynamicSummaries(filters, limit, context, signal),
    };
  }

  private prepareCreateTiming(
    createEventDto: CreateEventDto,
  ): CreateEventDto & { startAt: string; endAt: string } {
    const status = this.canonicalizeWriteStatus(
      createEventDto.status ?? EventStatus.Draft,
    );
    if (createEventDto.schedule === undefined) {
      this.assertRegistrationDeadlineBeforeStart(
        createEventDto.registration?.deadline,
        createEventDto.startAt,
      );
      this.assertActiveHasFutureTiming(status, createEventDto.endAt, undefined);
      return { ...createEventDto, status } as CreateEventDto & {
        startAt: string;
        endAt: string;
      };
    }

    if (
      createEventDto.startAt !== undefined ||
      createEventDto.endAt !== undefined
    ) {
      throw new BadRequestException(
        'schedule cannot be combined with startAt or endAt',
      );
    }

    const envelope = this.normalizeScheduleForWrite(createEventDto.schedule);
    this.assertRecurringMergedInvariants(undefined, status, envelope.schedule);
    this.assertActiveHasFutureTiming(status, envelope.endAt, envelope.schedule);
    this.assertRegistrationDeadlineBeforeStart(
      createEventDto.registration?.deadline,
      envelope.startAt,
    );

    return {
      ...createEventDto,
      status,
      schedule: envelope.schedule,
      startAt: envelope.startAt,
      endAt: envelope.endAt,
    };
  }

  private prepareUpdateTiming(
    updateEventDto: UpdateEventDto,
    existingEvent: DomainEventDocument,
  ): Record<string, unknown> {
    const updateData: Record<string, unknown> = { ...updateEventDto };
    if (updateEventDto.status !== undefined) {
      updateData.status = this.canonicalizeWriteStatus(updateEventDto.status);
    }
    const hasSchedule = hasOwnProperty(updateEventDto, 'schedule');
    const hasStartAt = hasOwnProperty(updateEventDto, 'startAt');
    const hasEndAt = hasOwnProperty(updateEventDto, 'endAt');

    if (hasSchedule) {
      if (hasStartAt || hasEndAt) {
        throw new BadRequestException(
          'schedule cannot be combined with startAt or endAt',
        );
      }

      const requestedMode = (
        updateEventDto.schedule as unknown as Record<string, unknown>
      )?.mode;
      if (
        isRecurringSchedule(existingEvent.schedule) &&
        requestedMode !== 'recurring' &&
        requestedMode !== 'manual'
      ) {
        throw new BadRequestException(
          'Recurring events require an explicit recurring update or manual conversion',
        );
      }

      const envelope = this.normalizeScheduleForWrite(updateEventDto.schedule);
      updateData.schedule = envelope.schedule;
      updateData.startAt = envelope.startAt;
      updateData.endAt = envelope.endAt;
    } else if (hasStartAt !== hasEndAt) {
      throw new BadRequestException(
        'startAt and endAt must be updated together',
      );
    } else if (hasStartAt && hasEndAt && existingEvent.schedule) {
      throw new BadRequestException(
        'scheduled events must be updated with schedule timing',
      );
    }

    const mergedStatus = this.canonicalizeWriteStatus(
      (updateData.status as EventStatus | undefined) ?? existingEvent.status,
    );
    const mergedSchedule = (updateData.schedule ??
      existingEvent.schedule) as DomainEventDocument['schedule'];
    this.assertRecurringMergedInvariants(
      existingEvent,
      mergedStatus,
      mergedSchedule,
    );
    if (
      hasOwnProperty(updateEventDto, 'status') ||
      hasSchedule ||
      hasStartAt ||
      hasEndAt
    ) {
      this.assertActiveHasFutureTiming(
        mergedStatus,
        typeof updateData.endAt === 'string'
          ? updateData.endAt
          : existingEvent.endAt,
        mergedSchedule,
      );
    }

    if (
      hasSchedule ||
      hasStartAt ||
      hasEndAt ||
      hasOwnProperty(updateEventDto, 'registration')
    ) {
      const activeStartAt =
        typeof updateData.startAt === 'string'
          ? updateData.startAt
          : existingEvent.startAt;
      const deadline = this.getEffectiveRegistrationDeadline(
        updateEventDto,
        existingEvent,
      );
      this.assertRegistrationDeadlineBeforeStart(deadline, activeStartAt);
    }

    return updateData;
  }

  private canonicalizeWriteStatus(status: EventStatus): EventStatus {
    const lifecycle = normalizeEffectiveLifecycle(status);
    if (lifecycle === 'invalid') {
      throw new BadRequestException('Unsupported event status');
    }
    return lifecycle;
  }

  private assertActiveHasFutureTiming(
    status: EventStatus,
    endAt: string | undefined,
    schedule: DomainEventDocument['schedule'] | undefined,
  ): void {
    if (status !== EventStatus.Active) return;

    if (isRecurringSchedule(schedule)) {
      const projection = projectEventScheduleForRead(
        schedule,
        status,
        new Date(Date.now()),
        2,
        false,
      );
      if (
        projection?.mode === 'recurring' &&
        projection.hasActiveOccurrences &&
        projection.nextActiveOccurrence
      ) {
        return;
      }
      throw new BadRequestException(
        'Active recurring events require a current or future occurrence',
      );
    }

    if (!endAt || new Date(endAt).getTime() <= Date.now()) {
      throw new BadRequestException('Active events require a future final end');
    }
  }

  private assertRecurringMergedInvariants(
    existingEvent: DomainEventDocument | undefined,
    mergedStatus: EventStatus,
    mergedSchedule: DomainEventDocument['schedule'] | undefined,
  ): void {
    const existingRecurringSchedule = isRecurringSchedule(
      existingEvent?.schedule,
    )
      ? existingEvent.schedule
      : undefined;
    const mergedRecurringSchedule = isRecurringSchedule(mergedSchedule)
      ? mergedSchedule
      : undefined;

    if (
      existingEvent?.status === EventStatus.Completed &&
      existingRecurringSchedule &&
      mergedStatus !== EventStatus.Completed
    ) {
      throw new BadRequestException('Completed events cannot be resumed');
    }

    if (mergedStatus === EventStatus.Completed && mergedRecurringSchedule) {
      if (!mergedRecurringSchedule.recurrence.endDate) {
        throw new BadRequestException(
          'Completed recurring events require recurrence.endDate',
        );
      }
    }

    if (
      existingEvent?.status === EventStatus.Completed &&
      existingRecurringSchedule &&
      !mergedRecurringSchedule
    ) {
      throw new BadRequestException(
        'Completed recurring events cannot be converted to manual mode',
      );
    }

    if (
      existingEvent?.status === EventStatus.Completed &&
      existingRecurringSchedule &&
      mergedRecurringSchedule
    ) {
      const oldCutoff = existingRecurringSchedule.recurrence.endDate;
      const nextCutoff = mergedRecurringSchedule.recurrence.endDate;
      if (!oldCutoff || !nextCutoff || nextCutoff > oldCutoff) {
        throw new BadRequestException(
          'Completed recurring event cutoff cannot be removed or extended',
        );
      }
    }

    if (
      existingRecurringSchedule &&
      mergedSchedule?.mode === 'manual' &&
      !existingRecurringSchedule.hasActiveOccurrences
    ) {
      throw new BadRequestException(
        'A recurring event without active occurrences cannot be converted to manual mode',
      );
    }
  }

  private getEffectiveRegistrationDeadline(
    updateEventDto: UpdateEventDto,
    existingEvent: DomainEventDocument,
  ): string | undefined {
    if (!hasOwnProperty(updateEventDto, 'registration')) {
      return existingEvent.registration?.deadline;
    }

    const registration = updateEventDto.registration;
    if (
      registration &&
      hasOwnProperty(registration, 'deadline') &&
      registration.deadline
    ) {
      return registration.deadline;
    }

    return undefined;
  }

  private normalizeScheduleForWrite(schedule: unknown) {
    try {
      return normalizeEventSchedule(schedule);
    } catch (error) {
      if (error instanceof EventScheduleValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private assertRegistrationDeadlineBeforeStart(
    deadline: string | undefined,
    startAt: string | undefined,
  ): void {
    if (!deadline || !startAt) {
      return;
    }

    if (new Date(deadline).getTime() > new Date(startAt).getTime()) {
      throw new BadRequestException(
        'registration.deadline must be before or equal to event start',
      );
    }
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
