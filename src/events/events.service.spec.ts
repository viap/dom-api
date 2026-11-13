import { ComponentSize } from '@/common/enums/component-size.enum';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import mongoose, { Types } from 'mongoose';
import { createRandomOrdering } from '@/pages/utils/entity-collection-ordering';
import { DomainsService } from '@/domains/domains.service';
import { LocationsService } from '@/locations/locations.service';
import { MediaService } from '@/media/media.service';
import { PartnersService } from '@/partners/partners.service';
import { Application } from '@/applications/schemas/application.schema';
import { PeopleService } from '@/people/people.service';
import { DomainEvent } from './schemas/domain-event.schema';
import { EventsService } from './events.service';
import { EventStatus } from './enums/event-status.enum';
import { EventType } from './enums/event-type.enum';
import { PageBlockType } from '@/pages/enums/page-block-type.enum';
import { BlockButtonType } from '@/pages/enums/block-button-type.enum';
import { RandomScanUnavailableException } from '@/common/utils/ranked-query';

describe('EventsService', () => {
  let service: EventsService;
  let dateNowSpy: jest.SpyInstance<number, []>;

  const mockEvent = {
    _id: '507f1f77bcf86cd799439021',
    domainId: '507f1f77bcf86cd799439022',
    type: 'seminar',
    status: 'planned',
    title: 'Event',
    description: 'Event description',
    slug: 'event',
    startAt: '2026-04-20T10:00:00.000Z',
    endAt: '2026-04-20T11:00:00.000Z',
    speakerIds: [],
    organizerIds: [],
    partnerIds: [],
    registration: { isOpen: false },
    blocks: [],
    schemaVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMedia = {
    _id: '507f1f77bcf86cd799439111',
    kind: 'image',
    url: '/media/event-cover.jpg',
    title: 'Event cover',
    alt: 'Event cover alt',
    isPublished: true,
  };

  const mockLocation = {
    _id: '507f1f77bcf86cd799439112',
    title: 'DOM Hall',
    address: 'Rustaveli 10',
    city: 'Tbilisi',
    country: 'Georgia',
    geo: { lat: 41.7151, lng: 44.8271 },
    notes: 'Internal venue notes',
    schemaVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSave = jest.fn().mockResolvedValue(mockEvent);
  const mockInstance = { save: mockSave };
  const mockEventUpdate = jest.fn();
  const mockEventModel = Object.assign(
    jest.fn().mockImplementation(() => mockInstance),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: mockEventUpdate,
      findOneAndUpdate: jest.fn(
        (
          filter: { _id: string },
          update: { $set: unknown },
          options: unknown,
        ) => mockEventUpdate(filter._id, update.$set, options),
      ),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    },
  );

  const mockDomainsService = {
    getActiveById: jest.fn(),
    getActiveBySlug: jest.fn(),
    findManyByIds: jest.fn(),
    findAll: jest.fn(),
  };
  const mockLocationsService = {
    exists: jest.fn(),
    findManyByIds: jest.fn(),
  };
  const mockMediaService = {
    existsPublished: jest.fn(),
    existingPublishedIds: jest.fn(),
    findManyByIds: jest.fn(),
  };
  const mockPeopleService = {
    findDynamicSummaries: jest.fn(),
    exists: jest.fn(),
    existingIds: jest.fn(),
    findPublishedSummariesByIds: jest.fn(),
  };
  const mockPartnersService = {
    exists: jest.fn(),
    existingIds: jest.fn(),
  };
  const createFindQueryMock = (result: unknown[] = []) => {
    const exec = jest.fn().mockResolvedValue(result);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });

    return {
      sort,
      skip,
      limit,
      lean,
      exec,
    };
  };

  const createFindOneQueryMock = (result: unknown) => {
    const exec = jest.fn().mockResolvedValue(result);
    const lean = jest.fn().mockReturnValue({ exec });

    return {
      lean,
      exec,
    };
  };

  it.each([
    ['omitted blocks', undefined],
    ['replacement without size', {}],
    ['explicit Medium reset', { size: ComponentSize.Medium }],
  ] as const)('updates button sizes: %s', async (_name, sizeFields) => {
    const button = {
      label: 'Read',
      type: BlockButtonType.External,
      url: 'https://example.com',
    };
    const block = {
      id: 'cta',
      type: PageBlockType.Cta as const,
      buttons: [{ ...button, size: ComponentSize.ExtraLarge }],
    };
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: () => ({ exec: async () => ({ ...mockEvent, blocks: [block] }) }),
    });
    mockEventModel.findByIdAndUpdate.mockReturnValue({
      lean: () => ({ exec: async () => mockEvent }),
    });
    await service.update(
      mockEvent._id,
      sizeFields === undefined
        ? { title: 'Updated title' }
        : { blocks: [{ ...block, buttons: [{ ...button, ...sizeFields }] }] },
    );
    const update = mockEventModel.findByIdAndUpdate.mock.calls[0][1];
    if (sizeFields === undefined) {
      expect(update).not.toHaveProperty('blocks');
    } else {
      expect(update.blocks[0].buttons).toStrictEqual([
        { ...button, ...sizeFields },
      ]);
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getModelToken(DomainEvent.name),
          useValue: mockEventModel,
        },
        {
          provide: getModelToken(Application.name),
          useValue: {
            countDocuments: jest.fn().mockResolvedValue(0),
            aggregate: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: DomainsService, useValue: mockDomainsService },
        { provide: LocationsService, useValue: mockLocationsService },
        { provide: MediaService, useValue: mockMediaService },
        { provide: PeopleService, useValue: mockPeopleService },
        { provide: PartnersService, useValue: mockPartnersService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();
    dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-04-01T00:00:00.000Z').getTime());
    mockDomainsService.getActiveById.mockResolvedValue({
      _id: mockEvent.domainId,
    });
    mockDomainsService.findManyByIds.mockResolvedValue({
      items: [{ _id: mockEvent.domainId, slug: 'psych-center' }],
    });
    mockDomainsService.findAll.mockResolvedValue([]);
    mockLocationsService.exists.mockResolvedValue(true);
    mockLocationsService.findManyByIds.mockResolvedValue({ items: [] });
    mockMediaService.existsPublished.mockResolvedValue(true);
    mockMediaService.findManyByIds.mockResolvedValue({ items: [] });
    mockPeopleService.exists.mockResolvedValue(true);
    mockPartnersService.exists.mockResolvedValue(true);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('reconciles expired non-recurring events with a revision increment', async () => {
    const now = new Date('2026-04-20T12:00:00.000Z');
    await service.reconcileExpiredNonRecurring(now, mockEvent._id);

    expect(mockEventModel.updateMany).toHaveBeenCalledWith(
      {
        _id: mockEvent._id,
        status: {
          $in: ['active', 'planned', 'registration_open', 'ongoing'],
        },
        'schedule.mode': { $ne: 'recurring' },
        endAt: { $lte: now.toISOString() },
      },
      {
        $set: { status: 'completed' },
        $inc: { __v: 1 },
      },
      { timestamps: false },
    );
  });

  it('does not return stale public data when reconciliation fails', async () => {
    mockEventModel.updateMany.mockRejectedValueOnce(
      new Error('reconciliation failed'),
    );

    await expect(service.findAll({})).rejects.toThrow('reconciliation failed');
    expect(mockEventModel.find).not.toHaveBeenCalled();
  });

  it('builds public, domain-scoped upcoming dynamic Event queries', async () => {
    const exec = jest
      .fn()
      .mockResolvedValue([
        { _id: '507f1f77bcf86cd799439099', title: 'Upcoming' },
      ]);
    const chain = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec,
    };
    mockEventModel.find.mockReturnValue(chain);

    await expect(
      service.findDynamicSummaries(
        {
          types: [EventType.Seminar],
          lifecycle: 'active',
          temporal: { mode: 'upcoming' },
          locationIds: ['507f1f77bcf86cd799439112'],
          peopleIds: ['507f1f77bcf86cd799439113'],
        },
        6,
        {
          domainId: mockEvent.domainId,
          now: new Date('2026-09-10T12:00:00.000Z'),
        },
      ),
    ).resolves.toEqual([{ id: '507f1f77bcf86cd799439099', label: 'Upcoming' }]);

    expect(mockEventModel.find).toHaveBeenCalledWith({
      domainId: { $in: [mockEvent.domainId] },
      status: { $in: ['active', 'planned', 'registration_open', 'ongoing'] },
      type: { $in: ['seminar'] },
      locationId: { $in: ['507f1f77bcf86cd799439112'] },
      $or: [
        { speakerIds: { $in: ['507f1f77bcf86cd799439113'] } },
        { organizerIds: { $in: ['507f1f77bcf86cd799439113'] } },
      ],
      $and: [
        {
          $or: [
            {
              'schedule.mode': { $ne: 'recurring' },
              endAt: { $gte: '2026-09-10T12:00:00.000Z' },
            },
            {
              'schedule.mode': 'recurring',
              status: {
                $in: ['active', 'planned', 'registration_open', 'ongoing'],
              },
              'schedule.hasActiveOccurrences': true,
              $or: [
                { 'schedule.recurrence.endDate': { $exists: false } },
                {
                  'schedule.recurrence.endDate': { $exists: true },
                  endAt: { $gte: '2026-09-10T12:00:00.000Z' },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(chain.sort).toHaveBeenCalledWith({ startAt: 1, title: 1, _id: 1 });
    expect(chain.limit).toHaveBeenCalledWith(6);
  });

  it('returns safe Event preview metadata with one bounded location lookup', async () => {
    const event = {
      ...mockEvent,
      locationId: mockLocation._id,
      schedule: {
        timezone: 'Asia/Tbilisi',
        days: [{ date: '2026-04-20', startTime: '14:00', endTime: '15:00' }],
      },
    };
    const chain = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([event]),
    };
    mockEventModel.find.mockReturnValue(chain);
    mockLocationsService.findManyByIds.mockResolvedValueOnce({
      items: [mockLocation],
    });

    await expect(
      service.findDynamicPreviewItems({ temporal: { mode: 'upcoming' } }, 6, {
        domainId: mockEvent.domainId,
        now: new Date('2026-09-10T12:00:00.000Z'),
      }),
    ).resolves.toEqual([
      {
        id: mockEvent._id,
        label: 'Event',
        metadata: {
          eventType: 'seminar',
          startAt: mockEvent.startAt,
          endAt: mockEvent.endAt,
          schedule: event.schedule,
          locationTitle: 'DOM Hall',
        },
      },
    ]);
    expect(chain.select).toHaveBeenCalledWith({
      _id: 1,
      title: 1,
      type: 1,
      startAt: 1,
      endAt: 1,
      status: 1,
      schedule: 1,
      locationId: 1,
    });
    expect(mockLocationsService.findManyByIds).toHaveBeenCalledWith([
      mockLocation._id,
    ]);
  });

  it('keeps Event preview rows successful when optional location metadata cannot load', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest
        .fn()
        .mockResolvedValue([{ ...mockEvent, locationId: mockLocation._id }]),
    };
    mockEventModel.find.mockReturnValue(chain);
    mockLocationsService.findManyByIds.mockRejectedValueOnce(
      new Error('locations unavailable'),
    );

    await expect(
      service.findDynamicPreviewItems({ temporal: { mode: 'upcoming' } }, 6, {
        domainId: mockEvent.domainId,
        now: new Date('2026-09-10T12:00:00.000Z'),
      }),
    ).resolves.toEqual([
      {
        id: mockEvent._id,
        label: 'Event',
        metadata: {
          eventType: 'seminar',
          startAt: mockEvent.startAt,
          endAt: mockEvent.endAt,
        },
      },
    ]);
  });

  it('fills Any-time results from current/upcoming before recent past', async () => {
    const chainFor = (items: unknown[]) => ({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(items),
    });
    const upcoming = chainFor([
      { _id: '507f1f77bcf86cd799439090', title: 'Current' },
    ]);
    const past = chainFor([{ _id: '507f1f77bcf86cd799439091', title: 'Past' }]);
    mockEventModel.find.mockReturnValueOnce(upcoming).mockReturnValueOnce(past);
    mockDomainsService.findAll.mockResolvedValue([{ _id: mockEvent.domainId }]);

    await expect(
      service.findDynamicSummaries({}, 2, {
        now: new Date('2026-09-10T12:00:00.000Z'),
      }),
    ).resolves.toEqual([
      { id: '507f1f77bcf86cd799439090', label: 'Current' },
      { id: '507f1f77bcf86cd799439091', label: 'Past' },
    ]);

    expect(upcoming.sort).toHaveBeenCalledWith({
      startAt: 1,
      title: 1,
      _id: 1,
    });
    expect(past.sort).toHaveBeenCalledWith({ startAt: -1, title: 1, _id: 1 });
    expect(past.limit).toHaveBeenCalledWith(1);
    expect(mockEventModel.find).toHaveBeenNthCalledWith(1, {
      domainId: { $in: [mockEvent.domainId] },
      status: {
        $in: [
          'active',
          'planned',
          'registration_open',
          'ongoing',
          'completed',
          'cancelled',
        ],
      },
      $and: [
        {
          $or: [
            {
              'schedule.mode': { $ne: 'recurring' },
              endAt: { $gte: '2026-09-10T12:00:00.000Z' },
            },
            {
              'schedule.mode': 'recurring',
              status: {
                $in: ['active', 'planned', 'registration_open', 'ongoing'],
              },
              'schedule.hasActiveOccurrences': true,
              $or: [
                { 'schedule.recurrence.endDate': { $exists: false } },
                {
                  'schedule.recurrence.endDate': { $exists: true },
                  endAt: { $gte: '2026-09-10T12:00:00.000Z' },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(mockEventModel.find).toHaveBeenNthCalledWith(2, {
      domainId: { $in: [mockEvent.domainId] },
      status: {
        $in: [
          'active',
          'planned',
          'registration_open',
          'ongoing',
          'completed',
          'cancelled',
        ],
      },
      $and: [
        {
          $or: [
            {
              'schedule.mode': { $ne: 'recurring' },
              endAt: { $lt: '2026-09-10T12:00:00.000Z' },
            },
            {
              'schedule.mode': 'recurring',
              status: 'completed',
            },
            {
              'schedule.mode': 'recurring',
              'schedule.hasActiveOccurrences': true,
              'schedule.recurrence.endDate': { $exists: true },
              endAt: { $lt: '2026-09-10T12:00:00.000Z' },
            },
            {
              'schedule.mode': 'recurring',
              'schedule.hasActiveOccurrences': false,
              'schedule.recurrence.endDate': { $lt: '2026-09-10' },
            },
          ],
        },
      ],
    });
  });

  it('returns events without domainId and does not validate domain', async () => {
    const findQuery = createFindQueryMock([mockEvent]);
    mockEventModel.find.mockReturnValue(findQuery);

    const result = await service.findAll({});

    expect(mockDomainsService.getActiveById).not.toHaveBeenCalled();
    expect(mockEventModel.find).toHaveBeenCalledWith({
      status: {
        $in: [
          'active',
          'planned',
          'registration_open',
          'ongoing',
          'completed',
          'cancelled',
        ],
      },
    });
    expect(findQuery.sort).toHaveBeenCalledWith({ startAt: 1, title: 1 });
    expect(findQuery.skip).toHaveBeenCalledWith(0);
    expect(findQuery.limit).toHaveBeenCalledWith(20);
    expect(mockMediaService.findManyByIds).not.toHaveBeenCalled();
    expect(mockLocationsService.findManyByIds).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        ...mockEvent,
        status: 'active',
        domainSlug: 'psych-center',
        registrationAvailability: 'closed',
      }),
    ]);
    expect(result[0]).not.toHaveProperty('registeredCount');
  });

  it('populates public event media when an event has a media id', async () => {
    const eventWithMedia = {
      ...mockEvent,
      mediaId: mockMedia._id,
    };
    const findQuery = createFindQueryMock([eventWithMedia]);
    mockEventModel.find.mockReturnValue(findQuery);
    mockMediaService.findManyByIds.mockResolvedValue({ items: [mockMedia] });

    const result = await service.findAll({});

    expect(mockMediaService.findManyByIds).toHaveBeenCalledWith([
      mockMedia._id,
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        ...eventWithMedia,
        status: 'active',
        mediaId: mockMedia,
        domainSlug: 'psych-center',
        registrationAvailability: 'closed',
      }),
    ]);
    expect(result[0]).not.toHaveProperty('registeredCount');
  });

  it('populates safe public event location in public lists', async () => {
    const eventWithLocation = {
      ...mockEvent,
      locationId: mockLocation._id,
    };
    const findQuery = createFindQueryMock([eventWithLocation]);
    mockEventModel.find.mockReturnValue(findQuery);
    mockLocationsService.findManyByIds.mockResolvedValue({
      items: [mockLocation],
    });

    const result = await service.findAll({});
    const event = result[0] as unknown as Record<string, unknown>;

    expect(mockLocationsService.findManyByIds).toHaveBeenCalledWith([
      mockLocation._id,
    ]);
    expect(event.locationId).toEqual({
      _id: mockLocation._id,
      title: mockLocation.title,
      address: mockLocation.address,
      city: mockLocation.city,
      country: mockLocation.country,
      geo: mockLocation.geo,
    });
    expect(event.locationId).not.toHaveProperty('notes');
  });

  it('omits sparse optional public event location fields without exposing notes', async () => {
    const sparseLocation = {
      _id: mockLocation._id,
      title: mockLocation.title,
      address: mockLocation.address,
      notes: 'Internal sparse notes',
    };
    const eventWithLocation = {
      ...mockEvent,
      locationId: mockLocation._id,
    };
    const findQuery = createFindQueryMock([eventWithLocation]);
    mockEventModel.find.mockReturnValue(findQuery);
    mockLocationsService.findManyByIds.mockResolvedValue({
      items: [sparseLocation],
    });

    const result = await service.findAll({});
    const event = result[0] as unknown as Record<string, unknown>;

    expect(event.locationId).toEqual({
      _id: mockLocation._id,
      title: mockLocation.title,
      address: mockLocation.address,
    });
    expect(event.locationId).not.toHaveProperty('city');
    expect(event.locationId).not.toHaveProperty('country');
    expect(event.locationId).not.toHaveProperty('geo');
    expect(event.locationId).not.toHaveProperty('notes');
  });

  it('resolves domain slugs for events with ObjectId domain ids', async () => {
    const domainObjectId = new Types.ObjectId(mockEvent.domainId);
    const eventWithObjectIdDomain = {
      ...mockEvent,
      domainId: domainObjectId,
    };
    const findQuery = createFindQueryMock([eventWithObjectIdDomain]);
    mockEventModel.find.mockReturnValue(findQuery);

    const result = await service.findAll({});

    expect(mockDomainsService.findManyByIds).toHaveBeenCalledWith([
      mockEvent.domainId,
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        ...eventWithObjectIdDomain,
        status: 'active',
        domainSlug: 'psych-center',
        registrationAvailability: 'closed',
      }),
    ]);
  });

  it('resolves domain slugs for events with populated domain ids', async () => {
    const domainObjectId = new Types.ObjectId(mockEvent.domainId);
    const eventWithPopulatedDomain = {
      ...mockEvent,
      domainId: { _id: domainObjectId, slug: 'psych-center' },
    };
    const findQuery = createFindQueryMock([eventWithPopulatedDomain]);
    mockEventModel.find.mockReturnValue(findQuery);

    const result = await service.findAll({});

    expect(mockDomainsService.findManyByIds).toHaveBeenCalledWith([
      mockEvent.domainId,
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        ...eventWithPopulatedDomain,
        status: 'active',
        domainSlug: 'psych-center',
        registrationAvailability: 'closed',
      }),
    ]);
  });

  it('populates safe public event location in public detail responses', async () => {
    const eventWithLocation = {
      ...mockEvent,
      locationId: mockLocation._id,
    };
    mockEventModel.findOne.mockReturnValue(
      createFindOneQueryMock(eventWithLocation),
    );
    mockLocationsService.findManyByIds.mockResolvedValue({
      items: [mockLocation],
    });

    const result = await service.findOne(mockEvent._id);
    const event = result as unknown as Record<string, unknown>;

    expect(mockLocationsService.findManyByIds).toHaveBeenCalledWith([
      mockLocation._id,
    ]);
    expect(event.locationId).toEqual({
      _id: mockLocation._id,
      title: mockLocation.title,
      address: mockLocation.address,
      city: mockLocation.city,
      country: mockLocation.country,
      geo: mockLocation.geo,
    });
    expect(event.locationId).not.toHaveProperty('notes');
  });

  it('keeps private occupancy and migration diagnostics out of public DTOs', async () => {
    const transitional = {
      ...mockEvent,
      __v: 9,
      capacity: 10,
      registration: { isOpen: true, maxParticipants: 20 },
      legacyStatus: 'planned',
      capacityConflict: { capacity: 10, maxParticipants: 20 },
      capacityInvalid: false,
      registeredCount: 7,
    };
    mockEventModel.findOne.mockReturnValue(
      createFindOneQueryMock(transitional),
    );

    const result = (await service.findOne(mockEvent._id)) as unknown as Record<
      string,
      unknown
    >;

    expect(result.status).toBe('active');
    expect(result.capacity).toBe(10);
    expect(result.registration).toEqual({ isOpen: true });
    expect(result).not.toHaveProperty('__v');
    expect(result).not.toHaveProperty('registeredCount');
    expect(result).not.toHaveProperty('legacyStatus');
    expect(result).not.toHaveProperty('capacityConflict');
    expect(result).not.toHaveProperty('capacityInvalid');
  });

  it('omits unusable raw capacity from public DTOs', async () => {
    mockEventModel.findOne.mockReturnValue(
      createFindOneQueryMock({
        ...mockEvent,
        capacity: 0,
        registration: { isOpen: true },
      }),
    );

    const result = (await service.findOne(mockEvent._id)) as unknown as Record<
      string,
      unknown
    >;

    expect(result).not.toHaveProperty('capacity');
    expect(result.registrationAvailability).toBe('closed');
  });

  it('populates safe public event location in public bulk responses', async () => {
    const eventWithLocation = {
      ...mockEvent,
      locationId: mockLocation._id,
    };
    const findQuery = createFindQueryMock([eventWithLocation]);
    mockEventModel.find.mockReturnValue(findQuery);
    mockLocationsService.findManyByIds.mockResolvedValue({
      items: [mockLocation],
    });

    const result = await service.findManyByIds([mockEvent._id]);
    const event = result.items[0] as unknown as Record<string, unknown>;

    expect(mockLocationsService.findManyByIds).toHaveBeenCalledWith([
      mockLocation._id,
    ]);
    expect(event.locationId).toEqual({
      _id: mockLocation._id,
      title: mockLocation.title,
      address: mockLocation.address,
      city: mockLocation.city,
      country: mockLocation.country,
      geo: mockLocation.geo,
    });
    expect(event.locationId).not.toHaveProperty('notes');
  });

  it('with domainId validates domain and filters by that domain', async () => {
    const findQuery = createFindQueryMock([mockEvent]);
    mockEventModel.find.mockReturnValue(findQuery);

    await service.findAll({ domainId: mockEvent.domainId });

    expect(mockDomainsService.getActiveById).toHaveBeenCalledWith(
      mockEvent.domainId,
    );
    expect(mockEventModel.find).toHaveBeenCalledWith({
      domainId: mockEvent.domainId,
      status: {
        $in: [
          'active',
          'planned',
          'registration_open',
          'ongoing',
          'completed',
          'cancelled',
        ],
      },
    });
  });

  it('bulk resolves draft admin events without public status filtering', async () => {
    const firstEvent = {
      ...mockEvent,
      _id: '507f1f77bcf86cd799439051',
      status: 'draft',
      title: 'Draft Event',
    };
    const secondEvent = {
      ...mockEvent,
      _id: '507f1f77bcf86cd799439052',
      status: 'cancelled',
      title: 'Cancelled Event',
    };
    const findQuery = createFindQueryMock([secondEvent, firstEvent]);
    mockEventModel.find.mockReturnValue(findQuery);

    const result = await service.findManyAdminByIds([
      firstEvent._id,
      'invalid',
      secondEvent._id,
    ]);

    expect(mockEventModel.find).toHaveBeenCalledWith({
      _id: { $in: [firstEvent._id, secondEvent._id] },
    });
    expect(mockMediaService.findManyByIds).not.toHaveBeenCalled();
    expect(result).toEqual({
      items: [
        expect.objectContaining(firstEvent),
        expect.objectContaining(secondEvent),
      ],
    });
  });

  it('filters public events by speaker or organizer personId', async () => {
    const findQuery = createFindQueryMock([mockEvent]);
    mockEventModel.find.mockReturnValue(findQuery);
    const personId = '507f1f77bcf86cd799439099';

    await service.findAll({ personId });

    expect(mockEventModel.find).toHaveBeenCalledWith({
      status: {
        $in: [
          'active',
          'planned',
          'registration_open',
          'ongoing',
          'completed',
          'cancelled',
        ],
      },
      $or: [{ speakerIds: personId }, { organizerIds: personId }],
    });
    expect(mockDomainsService.findManyByIds).toHaveBeenCalledWith([
      mockEvent.domainId,
    ]);
  });

  it('fails closed when an Event snapshot candidate universe exceeds its bound', async () => {
    jest.spyOn(service, 'findDynamicSummaries').mockResolvedValue([]);
    mockDomainsService.findAll.mockResolvedValue([{ _id: mockEvent.domainId }]);
    const candidates = Array.from({ length: 1001 }, (_, index) => ({
      ...mockEvent,
      _id: `candidate-${index}`,
    }));
    const exec = jest.fn().mockResolvedValue(candidates);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const select = jest.fn().mockReturnValue({ limit });
    mockEventModel.find.mockReturnValue({ select });

    await expect(
      service.findDynamicSnapshotCandidateIds({}, 12, {
        now: new Date('2026-11-13T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Event collection snapshot candidate limit exceeded');
    expect(limit).toHaveBeenCalledWith(1001);
  });

  it('limits snapshot transition candidates to events that can still cross a boundary', async () => {
    jest
      .spyOn(service, 'findDynamicSummaries')
      .mockResolvedValue([
        { id: 'selected-history', label: 'Selected history' },
      ]);
    mockDomainsService.findAll.mockResolvedValue([{ _id: mockEvent.domainId }]);
    const exec = jest.fn().mockResolvedValue([]);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const select = jest.fn().mockReturnValue({ limit });
    mockEventModel.find.mockReturnValue({ select });
    const now = new Date('2026-11-13T00:00:00.000Z');

    const result = await service.findDynamicSnapshotCandidateIds({}, 12, {
      now,
    });

    expect(mockEventModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: [
          {
            $or: [
              {
                'schedule.mode': { $ne: 'recurring' },
                endAt: { $gt: now.toISOString() },
              },
              expect.objectContaining({
                'schedule.mode': 'recurring',
                'schedule.hasActiveOccurrences': true,
              }),
            ],
          },
        ],
      }),
    );
    expect(result).toEqual({
      selectedIds: ['selected-history'],
      candidateIds: ['selected-history'],
    });
  });

  it('uses the shared Random cache policy and typed Default fallback for snapshots', async () => {
    const ordering = createRandomOrdering(
      {
        owner: { kind: 'page', pageId: '507f1f77bcf86cd799439099' },
        blockPath: ['events-random-review'],
        domainId: mockEvent.domainId,
        now: new Date('2026-11-13T00:00:00.000Z'),
      },
      'events',
    );
    const summaries = jest
      .spyOn(service, 'findDynamicSummaries')
      .mockRejectedValueOnce(new RandomScanUnavailableException('queue_full'))
      .mockResolvedValueOnce([{ id: mockEvent._id, label: mockEvent.title }]);
    mockDomainsService.findAll.mockResolvedValue([{ _id: mockEvent.domainId }]);
    const exec = jest.fn().mockResolvedValue([]);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const select = jest.fn().mockReturnValue({ limit });
    mockEventModel.find.mockReturnValue({ select });
    const cancellation = new AbortController();

    await expect(
      service.findDynamicSnapshotCandidateIds(
        {},
        12,
        { now: new Date('2026-11-13T00:00:00.000Z'), ordering },
        cancellation.signal,
        {
          owner: { kind: 'page', pageId: '507f1f77bcf86cd799439099' },
          blockPath: ['events-random-review'],
        },
      ),
    ).resolves.toMatchObject({ selectedIds: [mockEvent._id] });

    expect(summaries).toHaveBeenNthCalledWith(
      1,
      {},
      12,
      expect.objectContaining({ ordering }),
      undefined,
    );
    expect(summaries).toHaveBeenNthCalledWith(
      2,
      {},
      12,
      expect.objectContaining({ ordering: undefined }),
      cancellation.signal,
    );
  });

  it('passes optional description into the created event document', async () => {
    mockEventModel.findOne.mockResolvedValue(null);

    await service.create({
      domainId: mockEvent.domainId,
      type: 'seminar' as any,
      title: 'Event',
      description: 'Event description',
      slug: 'event',
      startAt: '2026-04-20T10:00:00.000Z',
      endAt: '2026-04-20T11:00:00.000Z',
    });

    expect(mockEventModel).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Event description',
      }),
    );
  });

  it('passes optional description into event updates', async () => {
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockEvent),
      }),
    });
    mockEventModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockEvent,
          description: '',
        }),
      }),
    });

    const result = await service.update(mockEvent._id, {
      description: '',
    });

    expect(mockEventModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockEvent._id,
      { description: '' },
      { new: true, runValidators: true },
    );
    expect(result.description).toBe('');
  });

  it.each([
    [
      'validation',
      (() => {
        const error = new mongoose.Error.ValidationError();
        error.addError(
          'title',
          new mongoose.Error.ValidatorError({ path: 'title' }),
        );
        return error;
      })(),
      'Update validation failed: title',
    ],
    [
      'cast',
      new mongoose.Error.CastError('String', {}, 'blocks'),
      'Update validation failed: blocks',
    ],
    [
      'strict',
      new mongoose.Error.StrictModeError('blocks'),
      'Update validation failed: blocks',
    ],
  ])(
    'maps Mongoose %s errors from event updates to HTTP 400',
    async (_name, persistenceError, expectedMessage) => {
      mockEventModel.findOne.mockResolvedValue(null);
      mockEventModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockEvent),
        }),
      });
      mockEventModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(persistenceError),
        }),
      });

      await expect(
        service.update(mockEvent._id, { title: 'Updated title' }),
      ).rejects.toMatchObject({
        message: expectedMessage,
        status: 400,
      });
    },
  );

  it('preserves unknown persistence failures from event updates', async () => {
    const persistenceError = new Error('database unavailable');
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockEvent),
      }),
    });
    mockEventModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(persistenceError),
      }),
    });

    await expect(
      service.update(mockEvent._id, { title: 'Updated title' }),
    ).rejects.toBe(persistenceError);
  });

  it('derives compatibility timing when creating with a schedule', async () => {
    mockEventModel.findOne.mockResolvedValue(null);

    await service.create({
      domainId: mockEvent.domainId,
      type: 'seminar' as any,
      title: 'Scheduled event',
      slug: 'scheduled-event',
      schedule: {
        timezone: 'Asia/Tbilisi',
        days: [
          { date: '2026-04-20', startTime: '14:00', endTime: '16:00' },
          { date: '2026-04-22', startTime: '15:00', endTime: '17:00' },
        ],
      },
    });

    expect(mockEventModel).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: {
          timezone: 'Asia/Tbilisi',
          days: [
            { date: '2026-04-20', startTime: '14:00', endTime: '16:00' },
            { date: '2026-04-22', startTime: '15:00', endTime: '17:00' },
          ],
        },
        startAt: '2026-04-20T10:00:00.000Z',
        endAt: '2026-04-22T13:00:00.000Z',
      }),
    );
  });

  it('rejects legacy PATCH requests that update only one timing field', async () => {
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockEvent),
      }),
    });

    await expect(
      service.update(mockEvent._id, {
        startAt: '2026-04-20T12:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockEventModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('allows paired legacy timing PATCH requests for legacy-only events', async () => {
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockEvent),
      }),
    });
    mockEventModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockEvent,
          startAt: '2026-04-20T12:00:00.000Z',
          endAt: '2026-04-20T13:00:00.000Z',
        }),
      }),
    });

    await service.update(mockEvent._id, {
      startAt: '2026-04-20T12:00:00.000Z',
      endAt: '2026-04-20T13:00:00.000Z',
    });

    expect(mockEventModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockEvent._id,
      {
        startAt: '2026-04-20T12:00:00.000Z',
        endAt: '2026-04-20T13:00:00.000Z',
      },
      { new: true, runValidators: true },
    );
  });

  it('rejects legacy timing PATCH requests for scheduled events', async () => {
    const scheduledEvent = {
      ...mockEvent,
      schedule: {
        timezone: 'Asia/Tbilisi',
        days: [{ date: '2026-04-20', startTime: '14:00', endTime: '16:00' }],
      },
    };
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(scheduledEvent),
      }),
    });

    await expect(
      service.update(mockEvent._id, {
        startAt: '2026-04-20T12:00:00.000Z',
        endAt: '2026-04-20T13:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockEventModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('allows non-timing PATCH requests for scheduled events', async () => {
    const scheduledEvent = {
      ...mockEvent,
      schedule: {
        timezone: 'Asia/Tbilisi',
        days: [{ date: '2026-04-20', startTime: '14:00', endTime: '16:00' }],
      },
    };
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(scheduledEvent),
      }),
    });
    mockEventModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...scheduledEvent,
          description: 'Updated',
        }),
      }),
    });

    await service.update(mockEvent._id, {
      description: 'Updated',
    });

    expect(mockEventModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockEvent._id,
      { description: 'Updated' },
      { new: true, runValidators: true },
    );
  });

  it('derives compatibility timing when patching with a schedule', async () => {
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockEvent),
      }),
    });
    mockEventModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockEvent,
          schedule: {
            timezone: 'Asia/Tbilisi',
            days: [
              {
                date: '2026-04-20',
                startTime: '14:00',
                endTime: '16:00',
              },
              {
                date: '2026-04-22',
                startTime: '15:00',
                endTime: '17:00',
              },
            ],
          },
          startAt: '2026-04-20T10:00:00.000Z',
          endAt: '2026-04-22T13:00:00.000Z',
        }),
      }),
    });

    await service.update(mockEvent._id, {
      schedule: {
        timezone: 'Asia/Tbilisi',
        days: [
          { date: '2026-04-20', startTime: '14:00', endTime: '16:00' },
          { date: '2026-04-22', startTime: '15:00', endTime: '17:00' },
        ],
      },
    });

    expect(mockEventModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockEvent._id,
      {
        schedule: {
          timezone: 'Asia/Tbilisi',
          days: [
            { date: '2026-04-20', startTime: '14:00', endTime: '16:00' },
            { date: '2026-04-22', startTime: '15:00', endTime: '17:00' },
          ],
        },
        startAt: '2026-04-20T10:00:00.000Z',
        endAt: '2026-04-22T13:00:00.000Z',
      },
      { new: true, runValidators: true },
    );
  });

  it('rejects deadline-only PATCH requests after a scheduled event start', async () => {
    const scheduledEvent = {
      ...mockEvent,
      schedule: {
        timezone: 'Asia/Tbilisi',
        days: [{ date: '2026-04-20', startTime: '14:00', endTime: '16:00' }],
      },
    };
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(scheduledEvent),
      }),
    });

    await expect(
      service.update(mockEvent._id, {
        registration: {
          deadline: '2026-04-20T10:00:01.000Z',
        },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockEventModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('uses the stored event envelope for registration-only PATCH on scheduled events', async () => {
    const scheduledEvent = {
      ...mockEvent,
      schedule: {
        timezone: 'Asia/Tbilisi',
        days: [{ date: '2026-04-20', startTime: '16:00', endTime: '14:00' }],
      },
    };
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(scheduledEvent),
      }),
    });
    mockEventModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...scheduledEvent,
          registration: {
            deadline: '2026-04-20T10:00:00.000Z',
          },
        }),
      }),
    });

    await service.update(mockEvent._id, {
      registration: {
        deadline: '2026-04-20T10:00:00.000Z',
      },
    });

    expect(mockEventModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockEvent._id,
      {
        registration: {
          deadline: '2026-04-20T10:00:00.000Z',
        },
      },
      { new: true, runValidators: true },
    );
  });

  it('should reject duplicate slug within the same domain', async () => {
    mockEventModel.findOne.mockResolvedValue(mockEvent);

    await expect(
      service.create({
        domainId: mockEvent.domainId,
        type: 'seminar' as any,
        title: 'Event',
        slug: 'event',
        startAt: '2026-04-20T10:00:00.000Z',
        endAt: '2026-04-20T11:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject missing referenced locations', async () => {
    mockEventModel.findOne.mockResolvedValue(null);
    mockLocationsService.exists.mockResolvedValue(false);

    await expect(
      service.create({
        domainId: mockEvent.domainId,
        type: 'seminar' as any,
        title: 'Event',
        slug: 'event-2',
        startAt: '2026-04-20T10:00:00.000Z',
        endAt: '2026-04-20T11:00:00.000Z',
        locationId: '507f1f77bcf86cd799439099',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject missing referenced published media during create', async () => {
    mockEventModel.findOne.mockResolvedValue(null);
    mockMediaService.existsPublished.mockResolvedValue(false);

    await expect(
      service.create({
        domainId: mockEvent.domainId,
        type: 'seminar' as any,
        title: 'Event',
        slug: 'event-with-cover',
        startAt: '2026-04-20T10:00:00.000Z',
        endAt: '2026-04-20T11:00:00.000Z',
        mediaId: '507f1f77bcf86cd799439111',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject update when existing merged media reference is missing', async () => {
    const existingEvent = {
      ...mockEvent,
      mediaId: '507f1f77bcf86cd799439111',
    };
    mockMediaService.existsPublished.mockResolvedValue(false);
    mockEventModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingEvent),
      }),
    });

    await expect(
      service.update(mockEvent._id, {
        status: 'ongoing' as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException for invalid public item ids', async () => {
    await expect(service.findOne('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('findOneByDomainSlugAndEventSlug', () => {
    it('returns public event by domain slug and event slug', async () => {
      const domain = { _id: mockEvent.domainId, slug: 'academy' };
      mockDomainsService.getActiveBySlug.mockResolvedValue(domain);
      mockPeopleService.findPublishedSummariesByIds.mockResolvedValue([]);

      const findOneLean = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockEvent),
      });
      mockEventModel.findOne.mockReturnValue({ lean: findOneLean });

      const result = await service.findOneByDomainSlugAndEventSlug(
        'academy',
        'event',
      );

      expect(mockDomainsService.getActiveBySlug).toHaveBeenCalledWith(
        'academy',
      );
      expect(mockEventModel.findOne).toHaveBeenCalledWith({
        domainId: domain._id,
        slug: 'event',
        status: {
          $in: [
            'active',
            'planned',
            'registration_open',
            'ongoing',
            'completed',
            'cancelled',
          ],
        },
      });
      expect(result.title).toBe(mockEvent.title);
    });

    it('populates safe public event location by domain slug and event slug', async () => {
      const domain = { _id: mockEvent.domainId, slug: 'academy' };
      const eventWithLocation = {
        ...mockEvent,
        locationId: mockLocation._id,
      };
      mockDomainsService.getActiveBySlug.mockResolvedValue(domain);
      mockPeopleService.findPublishedSummariesByIds.mockResolvedValue([]);
      mockEventModel.findOne.mockReturnValue(
        createFindOneQueryMock(eventWithLocation),
      );
      mockLocationsService.findManyByIds.mockResolvedValue({
        items: [mockLocation],
      });

      const result = await service.findOneByDomainSlugAndEventSlug(
        'academy',
        'event',
      );
      const event = result as unknown as Record<string, unknown>;

      expect(mockLocationsService.findManyByIds).toHaveBeenCalledWith([
        mockLocation._id,
      ]);
      expect(event.locationId).toEqual({
        _id: mockLocation._id,
        title: mockLocation.title,
        address: mockLocation.address,
        city: mockLocation.city,
        country: mockLocation.country,
        geo: mockLocation.geo,
      });
      expect(event.locationId).not.toHaveProperty('notes');
    });

    it('throws NotFoundException for draft events', async () => {
      const domain = { _id: mockEvent.domainId, slug: 'academy' };
      mockDomainsService.getActiveBySlug.mockResolvedValue(domain);

      const findOneLean = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockEventModel.findOne.mockReturnValue({ lean: findOneLean });

      await expect(
        service.findOneByDomainSlugAndEventSlug('academy', 'draft-event'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create with blocks and seo', () => {
    it('accepts seo in create payload', async () => {
      mockEventModel.findOne.mockResolvedValue(null);

      await service.create({
        domainId: mockEvent.domainId,
        type: 'seminar' as any,
        title: 'Event with SEO',
        slug: 'event-seo',
        startAt: '2026-04-20T10:00:00.000Z',
        endAt: '2026-04-20T11:00:00.000Z',
        seo: { title: 'Custom title', description: 'Meta description' },
      });

      expect(mockEventModel).toHaveBeenCalledWith(
        expect.objectContaining({
          seo: { title: 'Custom title', description: 'Meta description' },
        }),
      );
    });

    it('accepts empty blocks in create payload', async () => {
      mockEventModel.findOne.mockResolvedValue(null);

      await service.create({
        domainId: mockEvent.domainId,
        type: 'seminar' as any,
        title: 'Event with blocks',
        slug: 'event-blocks',
        startAt: '2026-04-20T10:00:00.000Z',
        endAt: '2026-04-20T11:00:00.000Z',
        blocks: [],
      });

      expect(mockEventModel).toHaveBeenCalledWith(
        expect.objectContaining({
          blocks: [],
        }),
      );
    });
  });

  describe('HTML snippet update compatibility', () => {
    it('keeps rejecting page-target buttons inside event HTML snippets', async () => {
      mockEventModel.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          domainId: mockEvent.domainId,
          type: 'seminar' as any,
          title: 'Snippet event',
          slug: 'snippet-event',
          startAt: '2026-04-20T10:00:00.000Z',
          endAt: '2026-04-20T11:00:00.000Z',
          blocks: [
            {
              id: 'html',
              type: PageBlockType.Html,
              template: 'vertical',
              content:
                '<span data-dom-html-snippet="button" data-dom-html-snippet-id="page"></span>',
              snippets: [
                {
                  id: 'page',
                  type: 'button',
                  button: {
                    label: 'Page',
                    type: BlockButtonType.Page,
                    targetId: '507f1f77bcf86cd799439099',
                  },
                },
              ],
            },
          ],
        }),
      ).rejects.toThrow('Page button links are not supported in event blocks');
    });

    it('preserves snippets omitted by an old-shaped event update', async () => {
      const marker =
        '<span data-dom-html-snippet="button" data-dom-html-snippet-id="saved"></span>';
      const savedSnippets = [
        {
          id: 'saved',
          type: 'button' as const,
          button: {
            label: 'Saved',
            type: BlockButtonType.External,
            url: 'https://example.com',
          },
        },
      ];
      mockEventModel.findOne.mockResolvedValue(null);
      mockEventModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockEvent,
            blocks: [
              {
                id: 'html',
                type: PageBlockType.Html,
                template: 'vertical',
                content: marker,
                snippets: savedSnippets,
              },
            ],
          }),
        }),
      });
      mockEventModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockEvent),
        }),
      });

      await service.update(mockEvent._id, {
        blocks: [
          {
            id: 'html',
            type: PageBlockType.Html,
            template: 'vertical',
            content: marker,
          },
        ],
      });

      expect(mockEventModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockEvent._id,
        expect.objectContaining({
          blocks: [expect.objectContaining({ snippets: savedSnippets })],
        }),
        { new: true, runValidators: true },
      );
    });

    it('rejects an old-shaped event update when stored block ids make preservation ambiguous', async () => {
      const marker =
        '<span data-dom-html-snippet="button" data-dom-html-snippet-id="saved"></span>';
      const storedHtmlBlock = {
        id: 'html',
        type: PageBlockType.Html,
        template: 'vertical',
        content: marker,
        snippets: [
          {
            id: 'saved',
            type: 'button',
            button: {
              label: 'Saved',
              type: BlockButtonType.External,
              url: 'https://example.com',
            },
          },
        ],
      };
      mockEventModel.findOne.mockResolvedValue(null);
      mockEventModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockEvent,
            blocks: [storedHtmlBlock, storedHtmlBlock],
          }),
        }),
      });

      await expect(
        service.update(mockEvent._id, {
          blocks: [
            {
              id: 'html',
              type: PageBlockType.Html,
              template: 'vertical',
              content: marker,
            },
          ],
        }),
      ).rejects.toThrow(
        'Cannot preserve omitted HTML snippets for ambiguous existing block id: html',
      );
      expect(mockEventModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('treats an explicit empty HTML snippet list as an intentional clear', async () => {
      const marker =
        '<span data-dom-html-snippet="button" data-dom-html-snippet-id="saved"></span>';
      mockEventModel.findOne.mockResolvedValue(null);
      mockEventModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockEvent,
            blocks: [
              {
                id: 'html',
                type: PageBlockType.Html,
                template: 'vertical',
                content: marker,
                snippets: [
                  {
                    id: 'saved',
                    type: 'button',
                    button: {
                      label: 'Saved',
                      type: BlockButtonType.External,
                      url: 'https://example.com',
                    },
                  },
                ],
              },
            ],
          }),
        }),
      });
      mockEventModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockEvent),
        }),
      });

      await service.update(mockEvent._id, {
        blocks: [
          {
            id: 'html',
            type: PageBlockType.Html,
            template: 'vertical',
            content: '<p>Cleared</p>',
            snippets: [],
          },
        ],
      });

      expect(mockEventModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockEvent._id,
        expect.objectContaining({
          blocks: [expect.objectContaining({ snippets: [] })],
        }),
        { new: true, runValidators: true },
      );
    });
  });
  it.each(['list', 'bulk'] as const)(
    '%s resolves 100 Event block trees without Random scans',
    async (mode) => {
      const dynamic = {
        id: 'random',
        type: 'entityCollection',
        entityType: 'people',
        source: 'dynamic',
        itemOrder: 'random',
        items: [],
        filters: {},
        limit: 100,
      };
      const events = Array.from({ length: 100 }, () => ({
        ...mockEvent,
        _id: new Types.ObjectId().toString(),
        blocks: [
          dynamic,
          {
            id: 'parent',
            type: 'cta',
            buttons: [{ type: 'block', block: { ...dynamic, id: 'child' } }],
          },
        ],
      }));
      const saved = JSON.stringify(events);
      const query = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(events),
      };
      mockEventModel.find.mockReturnValue(query);
      mockPeopleService.findDynamicSummaries.mockImplementation(
        async (_filters, _limit, ordering) => {
          if (ordering) throw new Error('List must not start Random work');
          return [{ id: 'default', label: 'Default' }];
        },
      );
      const result =
        mode === 'list'
          ? await service.findAll({ limit: '100' })
          : (await service.findManyByIds(events.map((event) => event._id)))
              .items;
      expect(result).toHaveLength(100);
      expect(mockPeopleService.findDynamicSummaries).toHaveBeenCalledTimes(200);
      expect(
        mockPeopleService.findDynamicSummaries.mock.calls.every(
          (args) => args[2] === undefined,
        ),
      ).toBe(true);
      expect(result[0].blocks).toMatchObject([
        { items: ['default'] },
        { buttons: [{ block: { items: ['default'] } }] },
      ]);
      expect(JSON.stringify(events)).toBe(saved);
    },
  );
  it('supplies persisted Event owner to embedded Random resolution', async () => {
    mockEventModel.findOne.mockReturnValue({
      lean: () => ({
        exec: async () => ({
          ...mockEvent,
          blocks: [
            {
              id: 'parent',
              type: 'cta',
              buttons: [
                {
                  type: 'block',
                  label: 'Open',
                  block: {
                    id: 'child',
                    type: 'entityCollection',
                    entityType: 'people',
                    source: 'dynamic',
                    layout: 'grid',
                    items: [],
                    filters: {},
                    itemOrder: 'random',
                  },
                },
              ],
            },
          ],
        }),
      }),
    });
    mockPeopleService.findDynamicSummaries.mockResolvedValue([
      { id: 'chosen', label: 'Chosen' },
    ]);
    await service.findOne(mockEvent._id);
    const context =
      mockPeopleService.findDynamicSummaries.mock.calls.at(-1)?.[2];
    expect(context).toEqual(
      createRandomOrdering(
        {
          now: new Date(),
          domainId: mockEvent.domainId,
          owner: { kind: 'event', eventId: mockEvent._id },
          blockPath: ['parent', 'child'],
        },
        'people',
      ),
    );
  });

  it('loads only the title for an application notification', async () => {
    const exec = jest.fn().mockResolvedValue({ title: 'Event' });
    const lean = jest.fn().mockReturnValue({ exec });
    const select = jest.fn().mockReturnValue({ lean });
    mockEventModel.findById.mockReturnValue({ select });

    await expect(service.getNotificationTitle(mockEvent._id)).resolves.toBe(
      'Event',
    );
    expect(select).toHaveBeenCalledWith({ title: 1 });
  });

  it('does not query for an invalid notification target id', async () => {
    await expect(service.getNotificationTitle('invalid')).resolves.toBeNull();
    expect(mockEventModel.findById).not.toHaveBeenCalled();
  });

  it('uses the validated revision in every successful Event update', async () => {
    const existing = { ...mockEvent, __v: 7 };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findByIdAndUpdate.mockReturnValue(
      createFindOneQueryMock({ ...existing, title: 'Updated', __v: 8 }),
    );

    await service.update(mockEvent._id, { title: 'Updated' });

    expect(mockEventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEvent._id, __v: 7 },
      { $set: { title: 'Updated' }, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
  });

  it('does not resolve a capacity conflict during an unrelated edit', async () => {
    const existing = {
      ...mockEvent,
      __v: 5,
      capacity: 10,
      registration: { isOpen: false, maxParticipants: 20 },
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findByIdAndUpdate.mockReturnValue(
      createFindOneQueryMock({ ...existing, title: 'Only title changed' }),
    );

    await service.update(mockEvent._id, {
      title: 'Only title changed',
      expectedRevision: 5,
    });

    expect(mockEventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEvent._id, __v: 5 },
      { $set: { title: 'Only title changed' }, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
  });

  it('resolves a capacity conflict only in the same exact CAS operation', async () => {
    const existing = {
      ...mockEvent,
      __v: 5,
      capacity: 10,
      registration: { isOpen: false, maxParticipants: 20 },
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findByIdAndUpdate.mockReturnValue(
      createFindOneQueryMock({
        ...existing,
        __v: 6,
        capacity: 20,
        registration: { isOpen: false },
      }),
    );

    await service.update(mockEvent._id, {
      expectedRevision: 5,
      capacityMutation: {
        action: 'use_legacy',
        expectedConflict: { capacity: 10, maxParticipants: 20 },
      },
    });

    expect(mockEventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEvent._id, __v: 5 },
      {
        $set: { capacity: 20 },
        $unset: { 'registration.maxParticipants': 1 },
        $inc: { __v: 1 },
      },
      { new: true, runValidators: true },
    );
  });

  it('requires explicit revision intent for canonical capacity mutations', async () => {
    const existing = { ...mockEvent, __v: 5, capacity: 10 };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);

    await expect(
      service.update(mockEvent._id, {
        capacityMutation: { action: 'set', value: 20 },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mockEventModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('uses an absent-revision predicate for an explicit missing revision', async () => {
    const existing = { ...mockEvent, capacity: 10 };
    delete (existing as { __v?: number }).__v;
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findOneAndUpdate.mockReturnValue(
      createFindOneQueryMock({ ...existing, capacity: 20, __v: 1 }),
    );

    await service.update(mockEvent._id, {
      expectedRevision: null,
      capacityMutation: { action: 'set', value: 20 },
    });

    expect(mockEventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEvent._id, __v: { $exists: false } },
      {
        $set: { capacity: 20 },
        $unset: { 'registration.maxParticipants': 1 },
        $inc: { __v: 1 },
      },
      { new: true, runValidators: true },
    );
  });

  it('rejects stale capacity snapshots before any partial update', async () => {
    const existing = {
      ...mockEvent,
      __v: 5,
      capacity: 10,
      registration: { isOpen: false, maxParticipants: 20 },
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);

    await expect(
      service.update(mockEvent._id, {
        expectedRevision: 5,
        capacityMutation: {
          action: 'clear',
          expectedConflict: { capacity: 10, maxParticipants: 21 },
        },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mockEventModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 409 instead of replaying a stale Event update', async () => {
    const existing = { ...mockEvent, __v: 3 };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findOneAndUpdate.mockReturnValue(
      createFindOneQueryMock(null),
    );

    await expect(
      service.update(mockEvent._id, { title: 'Stale' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mockEventModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('accepts an explicit edited manual subset when converting an open-ended recurring event', async () => {
    const existing = {
      ...mockEvent,
      __v: 4,
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-04-20',
          startTime: '14:00',
          endTime: '16:00',
        },
        cancelledDates: ['2026-04-27'],
        overrides: [{ date: '2026-05-04', description: 'Original override' }],
        hasActiveOccurrences: true,
      },
    };
    const manualSchedule = {
      timezone: 'Asia/Tbilisi' as const,
      mode: 'manual' as const,
      days: [
        {
          date: '2026-11-16',
          startTime: '15:00',
          endTime: '17:00',
          description: 'Edited after conversion',
        },
        { date: '2026-11-30', startTime: '14:00', endTime: '16:00' },
      ],
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findOneAndUpdate.mockReturnValue(
      createFindOneQueryMock({
        ...existing,
        __v: 5,
        schedule: manualSchedule,
      }),
    );

    await expect(
      service.update(mockEvent._id, { schedule: manualSchedule }),
    ).resolves.toBeDefined();

    expect(mockEventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEvent._id, __v: 4 },
      expect.objectContaining({
        $set: expect.objectContaining({ schedule: manualSchedule }),
        $inc: { __v: 1 },
      }),
      { new: true, runValidators: true },
    );
  });

  it('keeps an active open-ended recurring series editable after its first occurrence', async () => {
    const existing = {
      ...mockEvent,
      status: 'active',
      __v: 7,
      startAt: '2026-03-02T10:00:00.000Z',
      endAt: '2026-03-02T12:00:00.000Z',
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-03-02',
          startTime: '14:00',
          endTime: '16:00',
        },
        cancelledDates: [],
        overrides: [],
        hasActiveOccurrences: true,
      },
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findOneAndUpdate.mockReturnValue(
      createFindOneQueryMock({ ...existing, title: 'Updated', __v: 8 }),
    );

    await expect(
      service.update(mockEvent._id, { title: 'Updated' }),
    ).resolves.toBeDefined();
    expect(mockEventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEvent._id, __v: 7 },
      expect.objectContaining({
        $set: expect.objectContaining({ title: 'Updated' }),
        $inc: { __v: 1 },
      }),
      { new: true, runValidators: true },
    );
  });

  it('keeps unrelated edits available after a finite recurring series has ended', async () => {
    const existing = {
      ...mockEvent,
      status: 'active',
      __v: 8,
      startAt: '2026-03-02T10:00:00.000Z',
      endAt: '2026-03-30T12:00:00.000Z',
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-03-02',
          startTime: '14:00',
          endTime: '16:00',
          endDate: '2026-03-30',
        },
        cancelledDates: [],
        overrides: [],
        hasActiveOccurrences: true,
      },
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findOneAndUpdate.mockReturnValue(
      createFindOneQueryMock({ ...existing, title: 'Archived series', __v: 9 }),
    );

    await expect(
      service.update(mockEvent._id, { title: 'Archived series' }),
    ).resolves.toBeDefined();
    expect(mockEventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEvent._id, __v: 8 },
      expect.objectContaining({
        $set: expect.objectContaining({ title: 'Archived series' }),
        $inc: { __v: 1 },
      }),
      { new: true, runValidators: true },
    );
  });

  it('still rejects an explicit active write for an ended recurring series', async () => {
    const existing = {
      ...mockEvent,
      status: 'active',
      __v: 8,
      startAt: '2026-03-02T10:00:00.000Z',
      endAt: '2026-03-30T12:00:00.000Z',
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-03-02',
          startTime: '14:00',
          endTime: '16:00',
          endDate: '2026-03-30',
        },
        cancelledDates: [],
        overrides: [],
        hasActiveOccurrences: true,
      },
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);

    await expect(
      service.update(mockEvent._id, { status: 'active' as EventStatus }),
    ).rejects.toThrow(
      'Active recurring events require a current or future occurrence',
    );
    expect(mockEventModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('still rejects implicit and zero-active recurring-to-manual conversions', async () => {
    const recurringSchedule = {
      timezone: 'Asia/Tbilisi' as const,
      mode: 'recurring' as const,
      recurrence: {
        unit: 'week' as const,
        interval: 1 as const,
        anchorDate: '2026-04-20',
        startTime: '14:00',
        endTime: '16:00',
        endDate: '2026-04-20',
      },
      cancelledDates: ['2026-04-20'],
      overrides: [],
      hasActiveOccurrences: false,
    };
    const existing = {
      ...mockEvent,
      __v: 2,
      schedule: recurringSchedule,
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);

    await expect(
      service.update(mockEvent._id, {
        schedule: {
          timezone: 'Asia/Tbilisi',
          days: [{ date: '2026-04-20', startTime: '14:00', endTime: '16:00' }],
        },
      }),
    ).rejects.toThrow('explicit recurring update or manual conversion');

    await expect(
      service.update(mockEvent._id, {
        schedule: {
          timezone: 'Asia/Tbilisi',
          mode: 'manual',
          days: [{ date: '2026-04-20', startTime: '14:00', endTime: '16:00' }],
        },
      }),
    ).rejects.toThrow('without active occurrences');
    expect(mockEventModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects transitions away from persisted completed recurring status', async () => {
    const existing = {
      ...mockEvent,
      status: 'completed',
      __v: 1,
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-04-20',
          startTime: '14:00',
          endTime: '16:00',
          endDate: '2026-05-20',
        },
        cancelledDates: [],
        overrides: [],
        hasActiveOccurrences: true,
      },
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);

    await expect(
      service.update(mockEvent._id, { status: 'planned' as never }),
    ).rejects.toThrow('cannot be resumed');
    expect(mockEventModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('preserves status transitions for completed manual events', async () => {
    const existing = {
      ...mockEvent,
      status: 'completed',
      __v: 1,
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'manual',
        days: [{ date: '2026-04-20', startTime: '14:00', endTime: '16:00' }],
      },
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);
    mockEventModel.findOneAndUpdate.mockReturnValue(
      createFindOneQueryMock({ ...existing, status: 'planned', __v: 2 }),
    );

    await expect(
      service.update(mockEvent._id, { status: 'planned' as never }),
    ).resolves.toBeDefined();
    expect(mockEventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEvent._id, __v: 1 },
      { $set: { status: 'active' }, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
  });

  it('rejects completion with future exceptions after the cutoff', async () => {
    const existing = {
      ...mockEvent,
      __v: 1,
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-04-20',
          startTime: '14:00',
          endTime: '16:00',
        },
        cancelledDates: [],
        overrides: [],
        hasActiveOccurrences: true,
      },
    };
    mockEventModel.findById.mockReturnValue(createFindOneQueryMock(existing));
    mockEventModel.findOne.mockResolvedValue(null);

    await expect(
      service.update(mockEvent._id, {
        status: 'completed' as never,
        schedule: {
          timezone: 'Asia/Tbilisi',
          mode: 'recurring',
          recurrence: {
            unit: 'week',
            interval: 1,
            anchorDate: '2026-04-20',
            startTime: '14:00',
            endTime: '16:00',
            endDate: '2026-05-04',
          },
          cancelledDates: ['2026-05-11'],
          overrides: [],
        },
      }),
    ).rejects.toThrow('endDate');
    expect(mockEventModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('filters recurring custom-range occurrences before Default limit for summary and preview', async () => {
    const recurringEvent = (
      id: string,
      title: string,
      anchorDate: string,
      cancelledDates: string[] = [],
    ) => ({
      ...mockEvent,
      _id: id,
      title,
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate,
          startTime: '14:00',
          endTime: '16:00',
        },
        cancelledDates,
        overrides: [],
        hasActiveOccurrences: true,
      },
    });
    const rows = [
      recurringEvent(
        '507f1f77bcf86cd799439071',
        'False positive',
        '2026-01-01',
        ['2026-01-08'],
      ),
      recurringEvent('507f1f77bcf86cd799439072', 'Exact match', '2026-01-08'),
    ];
    const makeQuery = () => {
      const source = {
        async *[Symbol.asyncIterator]() {
          yield* rows;
        },
        close: jest.fn(async () => undefined),
      };
      return {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        batchSize: jest.fn().mockReturnThis(),
        maxTimeMS: jest.fn().mockReturnThis(),
        cursor: jest.fn(() => source),
      };
    };
    mockEventModel.find.mockImplementation(() => makeQuery());
    mockLocationsService.findManyByIds.mockResolvedValue({ items: [] });
    const filters = {
      temporal: {
        mode: 'custom' as const,
        from: '2026-01-08',
        to: '2026-01-08',
      },
    };
    const context = {
      domainId: mockEvent.domainId,
      now: new Date('2026-01-01T00:00:00.000Z'),
    };

    await expect(
      service.findDynamicSummaries(filters, 1, context),
    ).resolves.toEqual([
      { id: '507f1f77bcf86cd799439072', label: 'Exact match' },
    ]);
    const preview = await service.findDynamicPreviewItems(filters, 1, context);
    expect(preview.map((item) => item.id)).toEqual([
      '507f1f77bcf86cd799439072',
    ]);
  });
});
