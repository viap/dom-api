import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainCode } from '@/domains/enums/domain-code.enum';
import { DomainsService } from '@/domains/domains.service';
import { EventsService } from '@/events/events.service';
import { PartnersService } from '@/partners/partners.service';
import { ProgramsService } from '@/programs/programs.service';
import { UsersService } from '@/users/users.service';
import { ApplicationFormType } from './enums/application-form-type.enum';
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

  const mockDomainsService = { getActiveById: jest.fn(), getActiveByCode: jest.fn() };
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
    mockDomainsService.getActiveByCode.mockResolvedValue({
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

  it('should resolve domain by formType on create when domainId is omitted', async () => {
    const result = await service.create({
      formType: ApplicationFormType.ProgramEnrollment,
      applicant: mockApplication.applicant as any,
      payload: { programId: '507f1f77bcf86cd799439033' },
    });

    expect(mockDomainsService.getActiveByCode).toHaveBeenCalledWith(
      DomainCode.Academy,
    );
    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        formType: ApplicationFormType.ProgramEnrollment,
        domainId: mockApplication.domainId,
      }),
    );
    expect(result.domainId).toBe(mockApplication.domainId);
  });

  it('should keep explicit domainId on create when provided', async () => {
    const result = await service.create({
      domainId: mockApplication.domainId,
      formType: ApplicationFormType.General,
      applicant: mockApplication.applicant as any,
      payload: { message: 'General request' },
    });

    expect(mockDomainsService.getActiveById).toHaveBeenCalledWith(
      mockApplication.domainId,
    );
    expect(mockDomainsService.getActiveByCode).not.toHaveBeenCalled();
    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: mockApplication.domainId,
      }),
    );
    expect(result.domainId).toBe(mockApplication.domainId);
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

  it('should update explicit domainId on patch when provided', async () => {
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockApplication),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        ...mockApplication,
        domainId: '507f1f77bcf86cd799439099',
      }),
    });

    await service.update(mockApplication._id, {
      domainId: '507f1f77bcf86cd799439099',
      status: 'in_review' as any,
    });

    expect(mockDomainsService.getActiveById).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439099',
    );
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      expect.objectContaining({
        domainId: '507f1f77bcf86cd799439099',
      }),
      { new: true },
    );
  });

  it('should keep existing domainId on patch when domainId is omitted', async () => {
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockApplication),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockApplication),
    });

    await service.update(mockApplication._id, {
      status: 'in_review' as any,
    });

    expect(mockDomainsService.getActiveByCode).not.toHaveBeenCalled();
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      expect.not.objectContaining({
        domainId: expect.anything(),
      }),
      { new: true },
    );
  });

  it('should treat explicit domainId undefined as no-op on patch in direct service calls', async () => {
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockApplication),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockApplication),
    });

    await service.update(mockApplication._id, {
      domainId: undefined,
      status: 'in_review' as any,
    });

    expect(mockDomainsService.getActiveByCode).not.toHaveBeenCalled();
    expect(mockDomainsService.getActiveById).not.toHaveBeenCalledWith(
      undefined,
    );
    const updateArg = mockApplicationModel.findByIdAndUpdate.mock.calls[0][1];
    expect(Object.prototype.hasOwnProperty.call(updateArg, 'domainId')).toBe(
      false,
    );
  });

  it('should resolve domain by mapping on patch for legacy records without domainId', async () => {
    const legacyWithoutDomain = {
      ...mockApplication,
      domainId: undefined,
      formType: ApplicationFormType.General,
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(legacyWithoutDomain),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        ...legacyWithoutDomain,
        domainId: mockApplication.domainId,
      }),
    });

    await service.update(mockApplication._id, {
      status: 'in_review' as any,
    });

    expect(mockDomainsService.getActiveByCode).toHaveBeenCalledWith(
      DomainCode.PsychCenter,
    );
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      expect.objectContaining({
        domainId: mockApplication.domainId,
      }),
      { new: true },
    );
  });

  it('should propagate not found error when mapped active domain is missing', async () => {
    mockDomainsService.getActiveByCode.mockRejectedValue(
      new NotFoundException('Active domain not found'),
    );

    await expect(
      service.create({
        formType: ApplicationFormType.General,
        applicant: mockApplication.applicant as any,
        payload: { message: 'General request' },
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw for legacy applications with unmapped formType', async () => {
    const legacyWithoutDomain = {
      ...mockApplication,
      domainId: undefined,
      formType: 'legacy_form_type',
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(legacyWithoutDomain),
    });

    await expect(
      service.update(mockApplication._id, {
        status: 'in_review' as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException for invalid item ids', async () => {
    await expect(service.findOne('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
