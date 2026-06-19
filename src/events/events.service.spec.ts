import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainsService } from '@/domains/domains.service';
import { LocationsService } from '@/locations/locations.service';
import { MediaService } from '@/media/media.service';
import { PartnersService } from '@/partners/partners.service';
import { Application } from '@/applications/schemas/application.schema';
import { PeopleService } from '@/people/people.service';
import { DomainEvent } from './schemas/domain-event.schema';
import { EventsService } from './events.service';

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
  };
  const mockLocationsService = { exists: jest.fn() };
  const mockMediaService = {
    existsPublished: jest.fn(),
    existingPublishedIds: jest.fn(),
  };
  const mockPeopleService = {
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
          useValue: { countDocuments: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue([]) },
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
    mockLocationsService.exists.mockResolvedValue(true);
    mockMediaService.existsPublished.mockResolvedValue(true);
    mockPeopleService.exists.mockResolvedValue(true);
    mockPartnersService.exists.mockResolvedValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
    expect(result).toEqual([{ ...mockEvent, registeredCount: 0 }]);
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
});
