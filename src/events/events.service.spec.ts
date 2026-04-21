import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainsService } from '@/domains/domains.service';
import { LocationsService } from '@/locations/locations.service';
import { PartnersService } from '@/partners/partners.service';
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
    slug: 'event',
    startAt: '2026-04-20T10:00:00.000Z',
    endAt: '2026-04-20T11:00:00.000Z',
    speakerIds: [],
    organizerIds: [],
    partnerIds: [],
    registration: { isOpen: false },
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

  const mockDomainsService = { getActiveById: jest.fn() };
  const mockLocationsService = { exists: jest.fn() };
  const mockPeopleService = { exists: jest.fn() };
  const mockPartnersService = { exists: jest.fn() };
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
        { provide: DomainsService, useValue: mockDomainsService },
        { provide: LocationsService, useValue: mockLocationsService },
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
      status: { $ne: 'draft' },
    });
    expect(findQuery.sort).toHaveBeenCalledWith({ startAt: 1, title: 1 });
    expect(findQuery.skip).toHaveBeenCalledWith(0);
    expect(findQuery.limit).toHaveBeenCalledWith(20);
    expect(result).toEqual([mockEvent]);
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
      status: { $ne: 'draft' },
    });
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

  it('should throw NotFoundException for invalid public item ids', async () => {
    await expect(service.findOne('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
