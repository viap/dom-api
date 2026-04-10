import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainsService } from '@/domains/domains.service';
import { EventsService } from '@/events/events.service';
import { PartnersService } from '@/partners/partners.service';
import { ProgramsService } from '@/programs/programs.service';
import { UsersService } from '@/users/users.service';
import { Application } from './schemas/application.schema';
import { ApplicationsService } from './applications.service';

describe('ApplicationsService', () => {
  let service: ApplicationsService;

  const mockApplication = {
    _id: '507f1f77bcf86cd799439031',
    domainId: '507f1f77bcf86cd799439032',
    formType: 'event_registration',
    applicant: {
      name: 'John',
      contacts: [{ network: 'telegram', username: 'john', hidden: false }],
    },
    payload: { eventId: '507f1f77bcf86cd799439033' },
    status: 'new',
    notes: [],
    schemaVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSave = jest.fn().mockResolvedValue(mockApplication);
  const mockInstance = { save: mockSave };
  const mockApplicationModel = Object.assign(
    jest.fn().mockImplementation(() => mockInstance),
    {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    },
  );

  const mockDomainsService = { getActiveById: jest.fn() };
  const mockProgramsService = { exists: jest.fn() };
  const mockEventsService = { exists: jest.fn() };
  const mockPartnersService = { exists: jest.fn() };
  const mockUsersService = { getById: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: getModelToken(Application.name),
          useValue: mockApplicationModel,
        },
        { provide: DomainsService, useValue: mockDomainsService },
        { provide: ProgramsService, useValue: mockProgramsService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: PartnersService, useValue: mockPartnersService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    jest.clearAllMocks();
    mockDomainsService.getActiveById.mockResolvedValue({
      _id: mockApplication.domainId,
    });
    mockProgramsService.exists.mockResolvedValue(true);
    mockEventsService.exists.mockResolvedValue(true);
    mockPartnersService.exists.mockResolvedValue(true);
    mockUsersService.getById.mockResolvedValue({ _id: 'user-id' });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject invalid referenced event ids in payload', async () => {
    mockEventsService.exists.mockResolvedValue(false);

    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: 'event_registration' as any,
        applicant: mockApplication.applicant as any,
        payload: { eventId: '507f1f77bcf86cd799439033' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject unsupported source entity types', async () => {
    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: 'general' as any,
        applicant: mockApplication.applicant as any,
        source: { entityType: 'weird', entityId: '507f1f77bcf86cd799439099' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject invalid assigned users on update', async () => {
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockApplication),
    });
    mockUsersService.getById.mockResolvedValue(null);

    await expect(
      service.update('507f1f77bcf86cd799439031', {
        assignedTo: '507f1f77bcf86cd799439099',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException for invalid item ids', async () => {
    await expect(service.findOne('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
