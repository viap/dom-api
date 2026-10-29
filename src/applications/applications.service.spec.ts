import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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
import { ApplicationMessagingPolicyService } from '@/common/application-messaging/application-messaging-policy.service';
import { ApplicationContextResolver } from './application-context-resolver.service';
import { Types } from 'mongoose';

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
    findOne: jest.fn(),
    exists: jest.fn(),
  };
  const mockEventsService = {
    findOne: jest.fn(),
    exists: jest.fn(),
  };
  const mockPartnersService = { exists: jest.fn() };
  const mockPeopleService = { findOne: jest.fn(), exists: jest.fn() };
  const targetApplicationCases = [
    {
      label: 'program',
      formType: ApplicationFormType.ProgramEnrollment,
      targetKey: 'programId' as const,
      entityType: 'program',
      findTarget: mockProgramsService.findOne,
    },
    {
      label: 'event',
      formType: ApplicationFormType.EventRegistration,
      targetKey: 'eventId' as const,
      entityType: 'event',
      findTarget: mockEventsService.findOne,
    },
  ];
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
  const createContextResolver = () =>
    new ApplicationContextResolver(
      mockDomainsService as any,
      mockProgramsService as any,
      mockEventsService as any,
      mockPartnersService as any,
      mockPeopleService as any,
    );

  const createServiceWithConfig = (configService: { get: jest.Mock }) =>
    new ApplicationsService(
      mockApplicationModel as any,
      createContextResolver(),
      mockDomainsService as any,
      mockUsersService as any,
      mockNotificationsService as any,
      mockTelegramContactService as any,
      configService as any,
      {
        enabled: configService.get('APPLICATION_MESSAGING_ENABLED') === 'true',
        canUseAsSoleContact: (username?: string) =>
          Boolean(username) ||
          configService.get('APPLICATION_MESSAGING_ENABLED') === 'true',
      } as any,
    );

  const createServiceWithMessaging = (enabled: boolean) =>
    createServiceWithConfig({
      get: jest.fn((key: string) =>
        key === 'PUBLIC_WEB_URL'
          ? 'https://www.example.test'
          : key === 'APPLICATION_MESSAGING_ENABLED'
          ? String(enabled)
          : undefined,
      ),
    });

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
    jest.restoreAllMocks();
    mockApplicationModel.mockReset().mockImplementation(() => mockInstance);
    mockApplicationModel.find.mockReset();
    mockApplicationModel.findById.mockReset();
    mockApplicationModel.findByIdAndUpdate.mockReset();
    mockDomainsService.getActiveById.mockReset();
    mockDomainsService.getActiveByCode.mockReset();
    mockProgramsService.findOne.mockReset();
    mockProgramsService.exists.mockReset();
    mockEventsService.findOne.mockReset();
    mockEventsService.exists.mockReset();
    mockPartnersService.exists.mockReset();
    mockPeopleService.findOne.mockReset();
    mockPeopleService.exists.mockReset();
    mockUsersService.getById.mockReset();
    mockUsersService.getAllByRole.mockReset();
    mockNotificationsService.create.mockReset();
    mockTelegramContactService.assertTrustedWebClient.mockReset();
    mockTelegramContactService.resolveSession.mockReset();
    mockConfigService.get.mockReset();
    mockSave.mockReset();
    mockConfigService.get.mockImplementation((key: string) =>
      key === 'PUBLIC_WEB_URL'
        ? 'https://www.example.test'
        : key === 'APPLICATION_MESSAGING_ENABLED'
        ? 'false'
        : undefined,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationContextResolver,
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
        {
          provide: ApplicationMessagingPolicyService,
          useValue: {
            enabled: false,
            canUseAsSoleContact: (username?: string) => Boolean(username),
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    mockDomainsService.getActiveById.mockResolvedValue({
      _id: mockApplication.domainId,
    });
    mockDomainsService.getActiveByCode.mockResolvedValue({
      _id: mockApplication.domainId,
    });
    mockProgramsService.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439033',
      domainId: mockApplication.domainId,
      title: 'Program',
    });
    mockProgramsService.exists.mockResolvedValue(true);
    mockEventsService.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439033',
      domainId: mockApplication.domainId,
      title: 'Event',
    });
    mockEventsService.exists.mockResolvedValue(true);
    mockPartnersService.exists.mockResolvedValue(true);
    mockPeopleService.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439099',
      fullName: 'Published person',
    });
    mockPeopleService.exists.mockResolvedValue(true);
    mockUsersService.getById.mockResolvedValue({ _id: 'user-id' });
    mockUsersService.getAllByRole.mockResolvedValue([{ _id: 'admin-1' }]);
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

  it('rejects source context that conflicts with the event payload', async () => {
    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.EventRegistration,
        applicant: mockApplication.applicant as any,
        source: {
          entityType: 'program',
          entityId: '507f1f77bcf86cd799439099',
        },
        payload: { eventId: '507f1f77bcf86cd799439033' },
      }),
    ).rejects.toThrow('source conflicts');

    expect(mockEventsService.findOne).toHaveBeenCalledTimes(1);
    expect(mockApplicationModel).not.toHaveBeenCalled();
    expect(mockNotificationsService.create).not.toHaveBeenCalled();
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

  it('rejects a missing or non-public event before saving', async () => {
    mockEventsService.findOne.mockRejectedValueOnce(
      new NotFoundException('Event not found'),
    );

    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.EventRegistration,
        applicant: mockApplication.applicant as any,
        payload: mockApplication.payload,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockEventsService.findOne).toHaveBeenCalledTimes(1);
    expect(mockApplicationModel).not.toHaveBeenCalled();
    expect(mockNotificationsService.create).not.toHaveBeenCalled();
  });

  it('should reject invalid referenced event ids in payload', async () => {
    mockEventsService.findOne.mockRejectedValueOnce(
      new NotFoundException('Event not found'),
    );

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
    mockPeopleService.findOne.mockRejectedValueOnce(
      new NotFoundException('Person not found'),
    );

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

  it('derives program domain and canonical source while preserving UTM', async () => {
    const result = await service.create({
      formType: ApplicationFormType.ProgramEnrollment,
      applicant: mockApplication.applicant as any,
      source: { utm: { campaign: 'autumn' } },
      payload: { programId: '507f1f77bcf86cd799439033' },
    });

    expect(mockProgramsService.findOne).toHaveBeenCalledTimes(1);
    expect(mockProgramsService.findOne).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439033',
    );
    expect(mockDomainsService.getActiveByCode).not.toHaveBeenCalled();
    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        formType: ApplicationFormType.ProgramEnrollment,
        domainId: mockApplication.domainId,
        source: {
          entityType: 'program',
          entityId: '507f1f77bcf86cd799439033',
          utm: { campaign: 'autumn' },
        },
      }),
    );
    expect(result.domainId).toBe(mockApplication.domainId);
  });

  it('accepts matching event context and canonicalizes it from the payload', async () => {
    await service.create({
      domainId: mockApplication.domainId,
      formType: ApplicationFormType.EventRegistration,
      applicant: mockApplication.applicant as any,
      source: {
        entityType: 'event',
        entityId: '507f1f77bcf86cd799439033',
        utm: { source: 'newsletter' },
      },
      payload: { eventId: '507f1f77bcf86cd799439033' },
    });

    expect(mockEventsService.findOne).toHaveBeenCalledTimes(1);
    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: mockApplication.domainId,
        source: {
          entityType: 'event',
          entityId: '507f1f77bcf86cd799439033',
          utm: { source: 'newsletter' },
        },
      }),
    );
  });

  it('rejects a client domain that conflicts with the program domain', async () => {
    mockProgramsService.findOne.mockResolvedValueOnce({
      _id: '507f1f77bcf86cd799439033',
      domainId: '507f1f77bcf86cd799439088',
      title: 'Program',
    });

    await expect(
      service.create({
        domainId: mockApplication.domainId,
        formType: ApplicationFormType.ProgramEnrollment,
        applicant: mockApplication.applicant as any,
        payload: { programId: '507f1f77bcf86cd799439033' },
      }),
    ).rejects.toThrow('domainId conflicts');

    expect(mockProgramsService.findOne).toHaveBeenCalledTimes(1);
    expect(mockApplicationModel).not.toHaveBeenCalled();
  });

  it('uses a published person as canonical source without inventing a domain', async () => {
    await service.create({
      schemaVersion: 2,
      formType: ApplicationFormType.SpecialistRequest,
      applicant: mockApplication.applicant as any,
      source: { utm: { medium: 'profile' } },
      payload: {
        personId: '507f1f77bcf86cd799439099',
      },
    });

    expect(mockPeopleService.findOne).toHaveBeenCalledTimes(1);
    expect(mockDomainsService.getActiveByCode).toHaveBeenCalledWith(
      DomainCode.PsychCenter,
    );
    expect(mockApplicationModel).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: mockApplication.domainId,
        source: {
          entityType: 'person',
          entityId: '507f1f77bcf86cd799439099',
          utm: { medium: 'profile' },
        },
      }),
    );
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

  it.each([false, true])(
    'builds a verified Telegram username contact from a server session when messaging=%s',
    async (messagingEnabled) => {
      const configuredService = createServiceWithMessaging(messagingEnabled);
      mockTelegramContactService.resolveSession.mockResolvedValueOnce({
        identity: { _id: { toString: () => '507f1f77bcf86cd799439077' } },
        summary: {
          identityId: '507f1f77bcf86cd799439077',
          username: 'jane_doe',
          verifiedAt: '2026-10-28T08:00:00.000Z',
        },
      });

      await configuredService.createFromPublicWeb({
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
    },
  );

  it('rejects a username-less identity while messaging is disabled', async () => {
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

  it('returns a machine code for an invalid remembered contact session', async () => {
    mockTelegramContactService.resolveSession.mockRejectedValueOnce(
      new UnauthorizedException('invalid session'),
    );

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
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'contact_unavailable' }),
    });
  });

  it('allows a username-less trusted identity while messaging is enabled', async () => {
    const enabledService = createServiceWithMessaging(true);
    mockTelegramContactService.resolveSession.mockResolvedValueOnce({
      identity: { _id: { toString: () => '507f1f77bcf86cd799439077' } },
      summary: {
        identityId: '507f1f77bcf86cd799439077',
        verifiedAt: '2026-10-28T08:00:00.000Z',
      },
    });

    await enabledService.createFromPublicWeb({
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
            verifiedAt: '2026-10-28T08:00:00.000Z',
          },
          contacts: [],
        },
      }),
    );
  });

  it.each([false, true])(
    'keeps manual Telegram and phone contacts independent of messaging=%s',
    async (messagingEnabled) => {
      const configuredService = createServiceWithMessaging(messagingEnabled);

      await configuredService.createFromPublicWeb({
        apiClient: { name: 'web', password: 'secret' },
        application: {
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
          payload: { message: 'Telegram request' },
        },
      });
      await configuredService.createFromPublicWeb({
        apiClient: { name: 'web', password: 'secret' },
        application: {
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
          payload: { message: 'Phone request' },
        },
      });

      expect(mockTelegramContactService.resolveSession).not.toHaveBeenCalled();
    },
  );

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
    const generalApplication = {
      ...mockApplication,
      formType: ApplicationFormType.General,
      payload: { message: 'General request' },
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(generalApplication),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        ...generalApplication,
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
      {
        $set: expect.objectContaining({
          domainId: '507f1f77bcf86cd799439099',
        }),
        $unset: { source: 1 },
      },
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
    expect(mockEventsService.findOne).not.toHaveBeenCalled();
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      {
        $set: expect.not.objectContaining({
          domainId: expect.anything(),
          source: expect.anything(),
        }),
      },
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
    expect(
      Object.prototype.hasOwnProperty.call(updateArg.$set, 'domainId'),
    ).toBe(false);
  });

  it('allows unrelated patches on legacy records without canonical metadata', async () => {
    const legacyWithoutDomain = {
      ...mockApplication,
      domainId: undefined,
      source: undefined,
      formType: ApplicationFormType.General,
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(legacyWithoutDomain),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(legacyWithoutDomain),
    });

    await service.update(mockApplication._id, {
      status: 'in_review' as any,
    });

    expect(mockDomainsService.getActiveByCode).not.toHaveBeenCalled();
    expect(mockProgramsService.findOne).not.toHaveBeenCalled();
    expect(mockEventsService.findOne).not.toHaveBeenCalled();
    expect(mockPeopleService.findOne).not.toHaveBeenCalled();
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      {
        $set: expect.not.objectContaining({
          domainId: expect.anything(),
        }),
      },
      { new: true },
    );
  });

  it.each(targetApplicationCases)(
    'rejects a $label replacement payload without $targetKey',
    async ({ formType, targetKey, entityType, findTarget }) => {
      const targetId = '507f1f77bcf86cd799439033';
      const existingApplication = {
        ...mockApplication,
        formType,
        source: { entityType, entityId: targetId },
        payload: { [targetKey]: targetId, message: 'Old message' },
      };
      mockApplicationModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });

      await expect(
        service.update(mockApplication._id, {
          payload: { message: 'Updated message' },
        }),
      ).rejects.toThrow(`Referenced ${entityType} not found`);

      expect(findTarget).not.toHaveBeenCalled();
      expect(mockApplicationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  it.each(targetApplicationCases)(
    'allows an unchanged targetless legacy $label payload replacement',
    async ({ formType, findTarget }) => {
      const legacyApplication = {
        ...mockApplication,
        formType,
        source: undefined,
        payload: { message: 'Legacy message' },
      };
      mockApplicationModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(legacyApplication),
      });
      mockApplicationModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(legacyApplication),
      });

      const replacementPayload = { message: 'Updated legacy message' };
      await service.update(mockApplication._id, {
        payload: replacementPayload,
      });

      expect(findTarget).not.toHaveBeenCalled();
      expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockApplication._id,
        {
          $set: expect.objectContaining({ payload: replacementPayload }),
        },
        { new: true },
      );
    },
  );

  it.each(targetApplicationCases)(
    'replaces a $label payload without refetching its unchanged target',
    async ({ formType, targetKey, entityType, findTarget }) => {
      const targetId = '507f1f77bcf86cd799439033';
      const existingApplication = {
        ...mockApplication,
        formType,
        source: { entityType, entityId: targetId },
        payload: { [targetKey]: targetId, message: 'Old message' },
      };
      mockApplicationModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });
      mockApplicationModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });

      const replacementPayload = {
        [targetKey]: targetId,
        message: 'Updated message',
      };
      await service.update(mockApplication._id, {
        payload: replacementPayload,
      });

      expect(findTarget).not.toHaveBeenCalled();
      expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockApplication._id,
        {
          $set: expect.objectContaining({ payload: replacementPayload }),
        },
        { new: true },
      );
    },
  );

  it.each(targetApplicationCases)(
    'moves a $label payload target without inheriting its stale source identity',
    async ({ formType, targetKey, entityType, findTarget }) => {
      const oldTargetId = '507f1f77bcf86cd799439033';
      const nextTargetId = '507f1f77bcf86cd799439099';
      const nextDomainId = '507f1f77bcf86cd799439088';
      const existingApplication = {
        ...mockApplication,
        formType,
        source: {
          entityType,
          entityId: oldTargetId,
          utm: new Map([['campaign', 'legacy']]),
        },
        payload: { [targetKey]: oldTargetId },
      };
      mockApplicationModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });
      findTarget.mockResolvedValue({
        _id: nextTargetId,
        domainId: nextDomainId,
        title: `Moved ${entityType}`,
      });
      mockApplicationModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });

      await service.update(mockApplication._id, {
        payload: { [targetKey]: nextTargetId },
      });

      expect(findTarget).toHaveBeenCalledWith(nextTargetId);
      expect(mockDomainsService.getActiveById).toHaveBeenCalledWith(
        nextDomainId,
      );
      expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockApplication._id,
        {
          $set: expect.objectContaining({
            domainId: nextDomainId,
            payload: { [targetKey]: nextTargetId },
            source: {
              entityType,
              entityId: nextTargetId,
              utm: { campaign: 'legacy' },
            },
          }),
        },
        { new: true },
      );
    },
  );

  it.each(targetApplicationCases)(
    'repairs a $label domain while replacing stale stored source identity',
    async ({ formType, targetKey, entityType, findTarget }) => {
      const targetId = '507f1f77bcf86cd799439033';
      const repairedDomainId = '507f1f77bcf86cd799439088';
      const existingApplication = {
        ...mockApplication,
        formType,
        source: {
          entityType: 'partner',
          entityId: '507f1f77bcf86cd799439077',
          utm: new Map([['campaign', 'legacy']]),
        },
        payload: { [targetKey]: targetId },
      };
      mockApplicationModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });
      findTarget.mockResolvedValue({
        _id: targetId,
        domainId: repairedDomainId,
        title: `Repaired ${entityType}`,
      });
      mockApplicationModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });

      await service.update(mockApplication._id, {
        domainId: repairedDomainId,
      });

      expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockApplication._id,
        {
          $set: expect.objectContaining({
            domainId: repairedDomainId,
            source: {
              entityType,
              entityId: targetId,
              utm: { campaign: 'legacy' },
            },
          }),
        },
        { new: true },
      );
    },
  );

  it.each(targetApplicationCases)(
    'accepts the new target domain explicitly while moving a $label target',
    async ({ formType, targetKey, entityType, findTarget }) => {
      const oldTargetId = '507f1f77bcf86cd799439033';
      const nextTargetId = '507f1f77bcf86cd799439099';
      const nextDomainId = '507f1f77bcf86cd799439088';
      const existingApplication = {
        ...mockApplication,
        formType,
        source: { entityType, entityId: oldTargetId },
        payload: { [targetKey]: oldTargetId },
      };
      mockApplicationModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });
      findTarget.mockResolvedValue({
        _id: nextTargetId,
        domainId: nextDomainId,
        title: `Moved ${entityType}`,
      });
      mockApplicationModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });

      await service.update(mockApplication._id, {
        domainId: nextDomainId,
        payload: { [targetKey]: nextTargetId },
      });

      expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockApplication._id,
        {
          $set: expect.objectContaining({
            domainId: nextDomainId,
            payload: { [targetKey]: nextTargetId },
            source: { entityType, entityId: nextTargetId },
          }),
        },
        { new: true },
      );
    },
  );

  it.each(targetApplicationCases)(
    'rejects an explicit conflicting source while moving a $label target',
    async ({ formType, targetKey, entityType, findTarget }) => {
      const oldTargetId = '507f1f77bcf86cd799439033';
      const nextTargetId = '507f1f77bcf86cd799439099';
      const existingApplication = {
        ...mockApplication,
        formType,
        source: { entityType, entityId: oldTargetId },
        payload: { [targetKey]: oldTargetId },
      };
      mockApplicationModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });
      findTarget.mockResolvedValue({
        _id: nextTargetId,
        domainId: '507f1f77bcf86cd799439088',
        title: `Moved ${entityType}`,
      });

      await expect(
        service.update(mockApplication._id, {
          payload: { [targetKey]: nextTargetId },
          source: { entityType, entityId: oldTargetId },
        }),
      ).rejects.toThrow('source conflicts');

      expect(mockApplicationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  it.each(targetApplicationCases)(
    'rejects an explicit conflicting domain while moving a $label target',
    async ({ formType, targetKey, entityType, findTarget }) => {
      const oldTargetId = '507f1f77bcf86cd799439033';
      const nextTargetId = '507f1f77bcf86cd799439099';
      const existingApplication = {
        ...mockApplication,
        formType,
        source: { entityType, entityId: oldTargetId },
        payload: { [targetKey]: oldTargetId },
      };
      mockApplicationModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingApplication),
      });
      findTarget.mockResolvedValue({
        _id: nextTargetId,
        domainId: '507f1f77bcf86cd799439088',
        title: `Moved ${entityType}`,
      });

      await expect(
        service.update(mockApplication._id, {
          domainId: mockApplication.domainId,
          payload: { [targetKey]: nextTargetId },
        }),
      ).rejects.toThrow('domainId conflicts');

      expect(mockApplicationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('preserves the stored domain when a person payload target changes', async () => {
    const oldPersonId = '507f1f77bcf86cd799439033';
    const nextPersonId = '507f1f77bcf86cd799439099';
    const existingApplication = {
      ...mockApplication,
      formType: ApplicationFormType.SpecialistRequest,
      source: { entityType: 'person', entityId: oldPersonId },
      payload: { personId: oldPersonId },
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });
    mockPeopleService.findOne.mockResolvedValue({ _id: nextPersonId });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });

    await service.update(mockApplication._id, {
      payload: { personId: nextPersonId },
    });

    expect(mockDomainsService.getActiveByCode).not.toHaveBeenCalled();
    expect(mockDomainsService.getActiveById).toHaveBeenCalledWith(
      mockApplication.domainId,
    );
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      {
        $set: expect.objectContaining({
          domainId: mockApplication.domainId,
          payload: { personId: nextPersonId },
          source: { entityType: 'person', entityId: nextPersonId },
        }),
      },
      { new: true },
    );
  });

  it('replaces stale Partner source when resolving an existing Person target', async () => {
    const personId = '507f1f77bcf86cd799439099';
    const nextDomainId = '507f1f77bcf86cd799439088';
    const existingApplication = {
      ...mockApplication,
      formType: ApplicationFormType.SpecialistRequest,
      source: {
        entityType: 'partner',
        entityId: '507f1f77bcf86cd799439077',
        utm: new Map([['campaign', 'legacy']]),
      },
      payload: { personId },
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });
    mockPeopleService.findOne.mockResolvedValue({ _id: personId });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });

    await service.update(mockApplication._id, { domainId: nextDomainId });

    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      {
        $set: expect.objectContaining({
          domainId: nextDomainId,
          source: {
            entityType: 'person',
            entityId: personId,
            utm: { campaign: 'legacy' },
          },
        }),
      },
      { new: true },
    );
  });

  it('keeps only UTM source metadata when a person payload target is removed', async () => {
    const personId = '507f1f77bcf86cd799439033';
    const existingApplication = {
      ...mockApplication,
      formType: ApplicationFormType.SpecialistRequest,
      source: {
        entityType: 'person',
        entityId: personId,
        utm: new Map([['campaign', 'legacy']]),
      },
      payload: { personId },
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });

    await service.update(mockApplication._id, { payload: {} });

    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      {
        $set: expect.objectContaining({
          domainId: mockApplication.domainId,
          payload: {},
          source: { utm: { campaign: 'legacy' } },
        }),
      },
      { new: true },
    );
  });

  it('unsets stale source identity when a person target is removed without UTM', async () => {
    const personId = '507f1f77bcf86cd799439033';
    const existingApplication = {
      ...mockApplication,
      formType: ApplicationFormType.SpecialistRequest,
      source: { entityType: 'person', entityId: personId },
      payload: { personId },
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });

    await service.update(mockApplication._id, { payload: {} });

    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      {
        $set: expect.objectContaining({
          domainId: mockApplication.domainId,
          payload: {},
        }),
        $unset: { source: 1 },
      },
      { new: true },
    );
  });

  it('compares ObjectId-backed context with older-client string ids', async () => {
    const domainId = new Types.ObjectId();
    const eventId = new Types.ObjectId();
    const existingApplication = {
      ...mockApplication,
      domainId,
      formType: ApplicationFormType.EventRegistration,
      source: { entityType: 'event', entityId: eventId },
      payload: { eventId },
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });

    await service.update(mockApplication._id, {
      domainId: domainId.toString(),
      payload: { eventId: eventId.toString() },
    });

    expect(mockEventsService.findOne).not.toHaveBeenCalled();
    expect(mockDomainsService.getActiveById).not.toHaveBeenCalled();
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      {
        $set: expect.objectContaining({
          domainId: domainId.toString(),
          payload: { eventId: eventId.toString() },
        }),
      },
      { new: true },
    );
  });

  it('preserves the stored domain when a non-target source changes', async () => {
    const nextPartnerId = '507f1f77bcf86cd799439099';
    const existingApplication = {
      ...mockApplication,
      formType: ApplicationFormType.Partnership,
      source: {
        entityType: 'partner',
        entityId: '507f1f77bcf86cd799439033',
      },
      payload: { organizationName: 'DOM partner' },
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });
    mockPartnersService.exists.mockResolvedValue(true);
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(existingApplication),
    });

    await service.update(mockApplication._id, {
      source: { entityType: 'partner', entityId: nextPartnerId },
    });

    expect(mockDomainsService.getActiveByCode).not.toHaveBeenCalled();
    expect(mockDomainsService.getActiveById).toHaveBeenCalledWith(
      mockApplication.domainId,
    );
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      {
        $set: expect.objectContaining({
          domainId: mockApplication.domainId,
          source: { entityType: 'partner', entityId: nextPartnerId },
        }),
      },
      { new: true },
    );
  });

  it('does not refetch a legacy program for a UTM-only update', async () => {
    const legacyProgramApplication = {
      ...mockApplication,
      domainId: undefined,
      formType: ApplicationFormType.ProgramEnrollment,
      source: undefined,
      payload: { programId: '507f1f77bcf86cd799439033' },
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(legacyProgramApplication),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(legacyProgramApplication),
    });

    await service.update(mockApplication._id, {
      source: { utm: { source: 'admin' } },
    });

    expect(mockProgramsService.findOne).not.toHaveBeenCalled();
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockApplication._id,
      {
        $set: expect.objectContaining({
          source: { utm: { source: 'admin' } },
        }),
      },
      { new: true },
    );
  });

  it('rejects a conflicting source on a context-changing update', async () => {
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockApplication),
    });

    await expect(
      service.update(mockApplication._id, {
        source: {
          entityType: 'program',
          entityId: '507f1f77bcf86cd799439099',
        },
      }),
    ).rejects.toThrow('source conflicts');

    expect(mockEventsService.findOne).toHaveBeenCalledTimes(1);
    expect(mockApplicationModel.findByIdAndUpdate).not.toHaveBeenCalled();
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

  it('allows unrelated updates to legacy applications with unmapped formType', async () => {
    const legacyWithoutDomain = {
      ...mockApplication,
      domainId: undefined,
      formType: 'legacy_form_type',
    };
    mockApplicationModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(legacyWithoutDomain),
    });
    mockApplicationModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(legacyWithoutDomain),
    });

    await expect(
      service.update(mockApplication._id, {
        status: 'in_review' as any,
      }),
    ).resolves.toBe(legacyWithoutDomain);
    expect(mockDomainsService.getActiveByCode).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException for invalid item ids', async () => {
    await expect(service.findOne('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
