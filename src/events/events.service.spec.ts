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
import { EventType } from './enums/event-type.enum';
import { PageBlockType } from '@/pages/enums/page-block-type.enum';
import { BlockButtonType } from '@/pages/enums/block-button-type.enum';

describe('EventsService', () => {
  let service: EventsService;

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
  const mockEventModel = Object.assign(
    jest.fn().mockImplementation(() => mockInstance),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      status: { $in: ['planned', 'registration_open', 'ongoing'] },
      type: { $in: ['seminar'] },
      locationId: { $in: ['507f1f77bcf86cd799439112'] },
      $or: [
        { speakerIds: { $in: ['507f1f77bcf86cd799439113'] } },
        { organizerIds: { $in: ['507f1f77bcf86cd799439113'] } },
      ],
      endAt: { $gte: '2026-09-10T12:00:00.000Z' },
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
  });

  it('returns events without domainId and does not validate domain', async () => {
    const findQuery = createFindQueryMock([mockEvent]);
    mockEventModel.find.mockReturnValue(findQuery);

    const result = await service.findAll({});

    expect(mockDomainsService.getActiveById).not.toHaveBeenCalled();
    expect(mockEventModel.find).toHaveBeenCalledWith({
      status: {
        $in: [
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
      { ...mockEvent, domainSlug: 'psych-center', registeredCount: 0 },
    ]);
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
      {
        ...eventWithMedia,
        mediaId: mockMedia,
        domainSlug: 'psych-center',
        registeredCount: 0,
      },
    ]);
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
      {
        ...eventWithObjectIdDomain,
        domainSlug: 'psych-center',
        registeredCount: 0,
      },
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
      {
        ...eventWithPopulatedDomain,
        domainSlug: 'psych-center',
        registeredCount: 0,
      },
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
    expect(result).toEqual({ items: [firstEvent, secondEvent] });
  });

  it('filters public events by speaker or organizer personId', async () => {
    const findQuery = createFindQueryMock([mockEvent]);
    mockEventModel.find.mockReturnValue(findQuery);
    const personId = '507f1f77bcf86cd799439099';

    await service.findAll({ personId });

    expect(mockEventModel.find).toHaveBeenCalledWith({
      status: {
        $in: [
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
});
