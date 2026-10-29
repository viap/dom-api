import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DomainCode } from '@/domains/enums/domain-code.enum';
import { DomainsService } from '@/domains/domains.service';
import { EventsService } from '@/events/events.service';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
import { ProgramsService } from '@/programs/programs.service';
import { UsersService } from '@/users/users.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationTypes } from '@/notifications/enums/notification-types.enum';
import { TelegramContactService } from '@/telegram-contact/telegram-contact.service';
import { Role } from '@/roles/enums/roles.enum';
import { ApplicationFormType } from './enums/application-form-type.enum';
import { CreateApplicationDto } from './dto/create-application.dto';
import * as ApplicationNotification from './application-notification';
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

  const mockDomainsService = {
    getActiveById: jest.fn(),
    getActiveByCode: jest.fn(),
  };
  const mockProgramsService = {
    exists: jest.fn(),
    getNotificationTitle: jest.fn(),
  };
  const mockEventsService = {
    exists: jest.fn(),
    getNotificationTitle: jest.fn(),
  };
  const mockPartnersService = { exists: jest.fn() };
  const mockPeopleService = { exists: jest.fn() };
  const mockUsersService = {
    getById: jest.fn(),
    getAllByRole: jest.fn().mockResolvedValue([{ _id: 'admin-1' }]),
  };
  const mockNotificationsService = { create: jest.fn() };
  const mockTelegramContactService = {
    assertTrustedWebClient: jest.fn(),
    resolveSession: jest.fn(),
  };
  const mockConfigService = { get: jest.fn() };

  const createServiceWithConfig = (configService: { get: jest.Mock }) =>
    new ApplicationsService(
      mockApplicationModel as any,
      mockDomainsService as any,
      mockProgramsService as any,
      mockEventsService as any,
      mockPartnersService as any,
      mockPeopleService as any,
      mockUsersService as any,
      mockNotificationsService as any,
      mockTelegramContactService as any,
      configService as any,
    );

  const buildCreateDto = (
    formType: ApplicationFormType,
  ): CreateApplicationDto => {
    const base = {
      domainId: mockApplication.domainId,
      applicant: mockApplication.applicant as any,
    };

    switch (formType) {
      case ApplicationFormType.Partnership:
        return {
          ...base,
          formType,
          payload: { organizationName: 'DOM partner' },
        };
      case ApplicationFormType.ProgramEnrollment:
        return {
          ...base,
          formType,
          payload: { programId: '507f1f77bcf86cd799439033' },
        };
      case ApplicationFormType.EventRegistration:
        return {
          ...base,
          formType,
          payload: { eventId: '507f1f77bcf86cd799439033' },
        };
      case ApplicationFormType.CorporateTraining:
        return {
          ...base,
          formType,
          payload: { companyName: 'DOM' },
        };
      case ApplicationFormType.SpecialistRequest:
        return {
          ...base,
          formType,
          payload: { specialization: 'Family therapy' },
        };
      case ApplicationFormType.Supervision:
        return {
          ...base,
          schemaVersion: 2,
          formType,
          payload: { requestText: 'I need supervision support' },
        };
      case ApplicationFormType.General:
        return {
          ...base,
          formType,
          payload: { message: 'private message' },
        };
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('https://www.example.test');

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
        { provide: PeopleService, useValue: mockPeopleService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        {
          provide: TelegramContactService,
          useValue: mockTelegramContactService,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    mockDomainsService.getActiveById.mockResolvedValue({
      _id: mockApplication.domainId,
    });
    mockDomainsService.getActiveByCode.mockResolvedValue({
      _id: mockApplication.domainId,
    });
    mockProgramsService.exists.mockResolvedValue(true);
    mockProgramsService.getNotificationTitle.mockResolvedValue('Program');
    mockEventsService.exists.mockResolvedValue(true);
    mockEventsService.getNotificationTitle.mockResolvedValue('Event');
    mockPartnersService.exists.mockResolvedValue(true);
    mockPeopleService.exists.mockResolvedValue(true);
    mockUsersService.getById.mockResolvedValue({ _id: 'user-id' });
    mockNotificationsService.create.mockResolvedValue({ _id: 'notification' });
    mockSave.mockResolvedValue(mockApplication);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('fails service construction when PUBLIC_WEB_URL is invalid', () => {
    const configService = {
      get: jest.fn().mockReturnValue('http://localhost:3006'),
    };

    expect(() => createServiceWithConfig(configService)).toThrow(
      'PUBLIC_WEB_URL',
    );
  });

  it.each(Object.values(ApplicationFormType))(
    'creates one administrator message after saving %s',
    async (formType) => {
      const createDto = buildCreateDto(formType);
      const payload = createDto.payload;
      const saved = {
        ...mockApplication,
        formType,
        payload,
        applicant: {
          ...mockApplication.applicant,
          name: 'Jane',
        },
      };
      mockSave.mockResolvedValueOnce(saved);

      const result = await service.create({
        ...createDto,
        applicant: saved.applicant as any,
      });

      expect(result).toBe(saved);
      expect(mockNotificationsService.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationTypes.MESSAGE,
          roles: [Role.Admin],
          recipients: ['admin-1'],
          message: expect.stringMatching(
            /^Новая заявка с сайта: www\.example\.test\n\n.*Имя: Jane/su,
          ),
          messageEntities: [
            expect.objectContaining({
              type: 'text_link',
              url: 'https://www.example.test/',
            }),
            expect.objectContaining({
              type: 'text_link',
              url: `https://www.example.test/ru/admin/applications?applicationId=${mockApplication._id}`,
            }),
          ],
        }),
      );
      expect(
        mockNotificationsService.create.mock.calls[0][0],
      ).not.toHaveProperty('title');
      const notificationMessage =
        mockNotificationsService.create.mock.calls[0][0].message;
      expect(notificationMessage).not.toContain('telegram');
      expect(notificationMessage).not.toContain('john');
      expect(notificationMessage).not.toContain('private message');
      expect(notificationMessage).not.toContain('I need supervision support');
    },
  );

  it('uses the payload event id rather than source context', async () => {
    mockSave.mockResolvedValueOnce(mockApplication);

    await service.create({
      domainId: mockApplication.domainId,
      formType: ApplicationFormType.EventRegistration,
      applicant: mockApplication.applicant as any,
      source: {
        entityType: 'program',
        entityId: '507f1f77bcf86cd799439099',
      },
      payload: { eventId: '507f1f77bcf86cd799439033' },
    });

    expect(mockEventsService.getNotificationTitle).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439033',
    );
    expect(mockProgramsService.getNotificationTitle).not.toHaveBeenCalled();
  });

  it('does not attempt a notification when saving fails', async () => {
    mockSave.mockRejectedValueOnce(new Error('save failed'));

    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.General,
        applicant: mockApplication.applicant as any,
        payload: { message: 'General request' },
      }),
    ).rejects.toThrow('save failed');

    expect(mockNotificationsService.create).not.toHaveBeenCalled();
  });

  it('returns the saved application when notification formatting throws', async () => {
    const logger = { error: jest.fn(), warn: jest.fn() };
    (service as unknown as { logger: typeof logger }).logger = logger;
    const savedWithInvalidRuntimeName = {
      ...mockApplication,
      applicant: { ...mockApplication.applicant, name: undefined },
    };
    mockSave.mockResolvedValueOnce(savedWithInvalidRuntimeName);

    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.EventRegistration,
        applicant: mockApplication.applicant as any,
        payload: mockApplication.payload,
      }),
    ).resolves.toBe(savedWithInvalidRuntimeName);
    expect(mockNotificationsService.create).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Application notification failed applicationId=${mockApplication._id} stage=format reason=TypeError`,
    );
  });

  it('logs URL construction failures as format-stage errors', async () => {
    const logger = { error: jest.fn(), warn: jest.fn() };
    (service as unknown as { logger: typeof logger }).logger = logger;
    const buildUrl = jest
      .spyOn(ApplicationNotification, 'buildApplicationAdminUrl')
      .mockImplementationOnce(() => {
        throw new TypeError('url failed');
      });

    try {
      await expect(
        service.create({
          domainId: mockApplication.domainId,
          formType: ApplicationFormType.EventRegistration,
          applicant: mockApplication.applicant as any,
          payload: mockApplication.payload,
        }),
      ).resolves.toBe(mockApplication);
    } finally {
      buildUrl.mockRestore();
    }

    expect(logger.error).toHaveBeenCalledWith(
      `Application notification failed applicationId=${mockApplication._id} stage=format reason=TypeError`,
    );
  });

  it.each([
    [
      'notification exception',
      () =>
        mockNotificationsService.create.mockRejectedValueOnce(
          new Error('notification failed'),
        ),
    ],
    [
      'notification validation failure',
      () => mockNotificationsService.create.mockResolvedValueOnce(false),
    ],
  ])('returns the saved application after %s', async (_name, arrange) => {
    arrange();

    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.EventRegistration,
        applicant: mockApplication.applicant as any,
        payload: mockApplication.payload,
      }),
    ).resolves.toBe(mockApplication);
  });

  it.each([
    ['plain', (message: string) => message],
    ['JSON-encoded', (message: string) => JSON.stringify(message)],
  ])(
    'does not log %s notification contents from a create failure',
    async (_encoding, encodeMessage) => {
      const logger = { error: jest.fn(), warn: jest.fn() };
      (service as unknown as { logger: typeof logger }).logger = logger;
      mockNotificationsService.create.mockImplementationOnce(
        (notification: { message: string }) =>
          Promise.reject(
            new Error(`telegram ${encodeMessage(notification.message)}`),
          ),
      );

      await expect(
        service.create({
          domainId: mockApplication.domainId,
          formType: ApplicationFormType.EventRegistration,
          applicant: mockApplication.applicant as any,
          payload: mockApplication.payload,
        }),
      ).resolves.toBe(mockApplication);

      expect(logger.error).toHaveBeenCalledTimes(1);
      const logMessage = logger.error.mock.calls[0][0] as string;
      expect(logMessage).toBe(
        `Application notification failed applicationId=${mockApplication._id} stage=create reason=Error`,
      );
      expect(logMessage).not.toContain('Новая заявка с сайта');
      expect(logMessage).not.toContain('Имя: John');
      expect(logMessage).not.toContain('john');
    },
  );

  it('continues without an event title when lookup fails', async () => {
    const logger = { error: jest.fn(), warn: jest.fn() };
    (service as unknown as { logger: typeof logger }).logger = logger;
    mockEventsService.getNotificationTitle.mockRejectedValueOnce(
      new Error(`lookup\nfailed ${'x'.repeat(400)}`),
    );

    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.EventRegistration,
        applicant: mockApplication.applicant as any,
        payload: mockApplication.payload,
      }),
    ).resolves.toBe(mockApplication);

    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.not.stringContaining('Мероприятие:'),
      }),
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const logMessage = logger.warn.mock.calls[0][0] as string;
    expect(logMessage).toContain(
      `applicationId=${mockApplication._id} stage=target-title reason=Error`,
    );
    expect(logMessage).toContain('detail="lookup failed ');
    expect(logMessage).toContain('…"');
    expect(logMessage).not.toContain('\n');
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
    expect(mockNotificationsService.create).not.toHaveBeenCalled();
  });

  it('should reject invalid referenced person ids in specialist payload', async () => {
    mockPeopleService.exists.mockResolvedValue(false);

    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.SpecialistRequest,
        applicant: mockApplication.applicant as any,
        payload: {
          specialization: 'Family therapy',
          personId: '507f1f77bcf86cd799439099',
        },
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

  it('should resolve supervision applications to PsychCenter', async () => {
    await service.create({
      schemaVersion: 2,
      formType: ApplicationFormType.Supervision,
      applicant: mockApplication.applicant as any,
      payload: { requestText: 'I need supervision support' },
    });

    expect(mockDomainsService.getActiveByCode).toHaveBeenCalledWith(
      DomainCode.PsychCenter,
    );
    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 2,
        formType: ApplicationFormType.Supervision,
        domainId: mockApplication.domainId,
      }),
    );
  });

  it('should persist the explicit V2 schema version', async () => {
    await service.create({
      schemaVersion: 2,
      domainId: mockApplication.domainId,
      formType: ApplicationFormType.Partnership,
      applicant: mockApplication.applicant as any,
      payload: { message: 'Partnership request' },
    });

    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 2,
        formType: ApplicationFormType.Partnership,
        payload: { message: 'Partnership request' },
      }),
    );
  });

  it('projects a V3 manual Telegram contact once for legacy readers', async () => {
    await service.create({
      schemaVersion: 3,
      domainId: mockApplication.domainId,
      formType: ApplicationFormType.General,
      applicant: {
        name: 'Jane',
        preferredContact: {
          type: 'telegram_username' as any,
          username: 'jane_doe',
          verification: 'unverified',
        },
      },
      payload: { message: 'General request' },
    });

    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 3,
        applicant: {
          name: 'Jane',
          preferredContact: {
            type: 'telegram_username',
            username: 'jane_doe',
            verification: 'unverified',
          },
          contacts: [
            {
              network: 'telegram',
              username: '@jane_doe',
              hidden: false,
            },
          ],
        },
      }),
    );
  });

  it('projects one V3 phone contact without a duplicate WhatsApp contact', async () => {
    await service.create({
      schemaVersion: 3,
      domainId: mockApplication.domainId,
      formType: ApplicationFormType.General,
      applicant: {
        name: 'Jane',
        preferredContact: {
          type: 'phone' as any,
          phoneE164: '+995555123456',
          whatsappAvailable: true,
        },
      },
      payload: { message: 'General request' },
    });

    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 3,
        applicant: {
          name: 'Jane',
          preferredContact: {
            type: 'phone',
            phoneE164: '+995555123456',
            whatsappAvailable: true,
          },
          contacts: [
            {
              network: 'phone',
              username: '+995555123456',
              hidden: false,
            },
          ],
        },
      }),
    );
  });

  it('rejects a browser-supplied verified Telegram contact on the legacy public route', async () => {
    await expect(
      service.create({
        schemaVersion: 3,
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.General,
        applicant: {
          name: 'Jane',
          preferredContact: { type: 'telegram_identity' as any },
        },
        payload: { message: 'General request' },
      }),
    ).rejects.toThrow('requires a remembered session');
  });

  it('builds a verified Telegram contact only from a server session', async () => {
    mockTelegramContactService.resolveSession.mockResolvedValueOnce({
      identity: { _id: { toString: () => '507f1f77bcf86cd799439077' } },
      summary: {
        identityId: '507f1f77bcf86cd799439077',
        username: 'jane_doe',
        verifiedAt: '2026-10-28T08:00:00.000Z',
      },
    });

    await service.createFromPublicWeb({
      apiClient: { name: 'web', password: 'secret' },
      contactSessionToken: 's'.repeat(43),
      application: {
        schemaVersion: 3,
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.General,
        applicant: {
          name: 'Jane',
          preferredContact: { type: 'telegram_identity' as any },
        },
        payload: { message: 'General request' },
      },
    });

    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        applicant: {
          name: 'Jane',
          preferredContact: {
            type: 'telegram_identity',
            identityId: '507f1f77bcf86cd799439077',
            usernameSnapshot: 'jane_doe',
            verifiedAt: '2026-10-28T08:00:00.000Z',
          },
          contacts: [
            {
              network: 'telegram',
              username: '@jane_doe',
              hidden: false,
            },
          ],
        },
      }),
    );
  });

  it('does not allow a username-less identity as the sole Stage 4 contact', async () => {
    mockTelegramContactService.resolveSession.mockResolvedValueOnce({
      identity: { _id: { toString: () => '507f1f77bcf86cd799439077' } },
      summary: {
        identityId: '507f1f77bcf86cd799439077',
        verifiedAt: '2026-10-28T08:00:00.000Z',
      },
    });

    await expect(
      service.createFromPublicWeb({
        apiClient: { name: 'web', password: 'secret' },
        contactSessionToken: 's'.repeat(43),
        application: {
          schemaVersion: 3,
          domainId: mockApplication.domainId,
          formType: ApplicationFormType.General,
          applicant: {
            name: 'Jane',
            preferredContact: { type: 'telegram_identity' as any },
          },
          payload: { message: 'General request' },
        },
      }),
    ).rejects.toThrow('cannot be the sole contact');
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
        payload: { message: 'General request' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should accept person source entity references', async () => {
    await service.create({
      domainId: mockApplication.domainId,
      formType: ApplicationFormType.General,
      applicant: mockApplication.applicant as any,
      payload: { message: 'General request' },
      source: {
        entityType: 'person',
        entityId: '507f1f77bcf86cd799439099',
      },
    });

    expect(mockPeopleService.exists).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439099',
    );
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
