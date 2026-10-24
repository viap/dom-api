import { ComponentSize } from '@/common/enums/component-size.enum';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import mongoose from 'mongoose';
import { EntityCollectionItemOrder } from './enums/entity-collection-item-order.enum';
import { createRandomOrdering } from './utils/entity-collection-ordering';
import { EventsService } from '@/events/events.service';
import { DomainsService } from '@/domains/domains.service';
import { MediaService } from '@/media/media.service';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
import { PersonRole } from '@/people/enums/person-role.enum';
import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import { BlockButtonType } from './enums/block-button-type.enum';
import { EntityCollectionEntityType } from './enums/entity-collection-entity-type.enum';
import { EntityCollectionLayout } from './enums/entity-collection-layout.enum';
import { PageBlockType } from './enums/page-block-type.enum';
import { PageStatus } from './enums/page-status.enum';
import { Page } from './schemas/page.schema';
import { PagesService } from './pages.service';

describe('PagesService', () => {
  let service: PagesService;

  const mockPage = {
    _id: '507f1f77bcf86cd799439111',
    domainId: '507f1f77bcf86cd799439112',
    slug: 'about-us',
    title: 'About Us',
    status: PageStatus.Published,
    isHomepage: false,
    isTitleVisible: true,
    seo: { title: 'About Us' },
    blocks: [],
    schemaVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockGlobalPage = {
    _id: '507f1f77bcf86cd799439211',
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    status: PageStatus.Published,
    isHomepage: false,
    isTitleVisible: true,
    seo: { title: 'Privacy Policy' },
    blocks: [],
    schemaVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSave = jest.fn().mockResolvedValue(mockPage);
  const mockInstance = { save: mockSave };
  const mockPageModel = Object.assign(
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
  const mockPeopleService = {
    exists: jest.fn(),
    findOne: jest.fn(),
    existingIds: jest.fn(),
    findPublishedSummariesByIds: jest.fn(),
    findDynamicSummaries: jest.fn(),
    findDynamicPreviewItems: jest.fn(),
  };
  const mockPartnersService = {
    exists: jest.fn(),
    existingIds: jest.fn(),
    findDynamicSummaries: jest.fn(),
    findDynamicPreviewItems: jest.fn(),
  };
  const mockEventsService = {
    exists: jest.fn(),
    existingIds: jest.fn(),
    findDynamicSummaries: jest.fn(),
    findDynamicPreviewItems: jest.fn(),
  };
  const mockMediaService = {
    exists: jest.fn(),
    existingIds: jest.fn(),
    existingPublishedIds: jest.fn(),
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
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findById.mockReturnValue({
      lean: () => ({ exec: async () => ({ ...mockPage, blocks: [block] }) }),
    });
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: () => ({ exec: async () => mockPage }),
    });
    await service.update(
      mockPage._id,
      sizeFields === undefined
        ? { title: 'Updated title' }
        : { blocks: [{ ...block, buttons: [{ ...button, ...sizeFields }] }] },
    );
    const update = mockPageModel.findByIdAndUpdate.mock.calls[0][1];
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
        PagesService,
        {
          provide: getModelToken(Page.name),
          useValue: mockPageModel,
        },
        { provide: DomainsService, useValue: mockDomainsService },
        { provide: PeopleService, useValue: mockPeopleService },
        { provide: PartnersService, useValue: mockPartnersService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: MediaService, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
    jest.clearAllMocks();
    mockDomainsService.getActiveById.mockResolvedValue({
      _id: mockPage.domainId,
    });
    mockDomainsService.getActiveBySlug.mockResolvedValue({
      _id: mockPage.domainId,
      slug: 'academy',
    });
    mockPeopleService.exists.mockResolvedValue(true);
    mockPeopleService.findOne.mockImplementation(async (id: string) => ({
      _id: id,
      fullName: `Person ${id.slice(-4)}`,
    }));
    mockPeopleService.existingIds.mockImplementation(
      async (ids: string[]) => new Set(ids),
    );
    mockPeopleService.findPublishedSummariesByIds.mockImplementation(
      async (ids: string[]) =>
        ids.map((id) => ({
          _id: id,
          fullName: `Person ${id.slice(-4)}`,
        })),
    );
    mockPeopleService.findDynamicSummaries.mockResolvedValue([]);
    mockPeopleService.findDynamicPreviewItems.mockResolvedValue([]);
    mockPartnersService.findDynamicSummaries.mockResolvedValue([]);
    mockPartnersService.findDynamicPreviewItems.mockResolvedValue([]);
    mockEventsService.findDynamicSummaries.mockResolvedValue([]);
    mockEventsService.findDynamicPreviewItems.mockResolvedValue([]);
    mockPartnersService.exists.mockResolvedValue(true);
    mockPartnersService.existingIds.mockImplementation(
      async (ids: string[]) => new Set(ids),
    );
    mockEventsService.exists.mockResolvedValue(true);
    mockEventsService.existingIds.mockImplementation(
      async (ids: string[]) => new Set(ids),
    );
    mockMediaService.exists.mockResolvedValue(true);
    mockMediaService.existingIds.mockImplementation(
      async (ids: string[]) => new Set(ids),
    );
    mockMediaService.existingPublishedIds.mockImplementation(
      async (ids: string[]) => new Set(ids),
    );
  });

  it('uses the same People resolver for preview with the supplied global context', async () => {
    mockPeopleService.findDynamicPreviewItems.mockResolvedValueOnce([
      {
        id: '507f1f77bcf86cd799439031',
        label: 'Ada',
        metadata: { professionalTitle: 'Therapist' },
      },
    ]);

    await expect(
      service.previewEntityCollection({
        entityType: EntityCollectionEntityType.People,
        filters: { roles: [PersonRole.Team] },
        limit: 4,
        contextDomainId: null,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: '507f1f77bcf86cd799439031',
          label: 'Ada',
          metadata: { professionalTitle: 'Therapist' },
        },
      ],
    });
    expect(mockPeopleService.findDynamicPreviewItems).toHaveBeenCalledWith(
      { roles: [PersonRole.Team] },
      4,
      undefined,
      undefined,
    );
  });

  it('does not start preview resolution after cancellation during domain validation', async () => {
    const cancellation = new AbortController();
    const reason = new Error('preview cancelled');
    mockDomainsService.getActiveById.mockImplementationOnce(async () => {
      cancellation.abort(reason);
      return {};
    });
    await expect(
      service.previewEntityCollection(
        {
          entityType: EntityCollectionEntityType.People,
          filters: {},
          contextDomainId: '507f1f77bcf86cd799439221',
        },
        cancellation.signal,
      ),
    ).rejects.toBe(reason);
    expect(mockPeopleService.findDynamicPreviewItems).not.toHaveBeenCalled();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should require domainId for public list queries', async () => {
    await expect(service.findAll({})).rejects.toThrow(BadRequestException);
  });

  it('should reject duplicate slug within the same domain', async () => {
    mockPageModel.findOne.mockResolvedValue(mockPage);

    await expect(
      service.create({
        domainId: mockPage.domainId,
        title: 'About Us',
        slug: 'about-us',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject duplicate slug across different domains', async () => {
    mockPageModel.findOne.mockResolvedValueOnce({
      ...mockPage,
      _id: '507f1f77bcf86cd799439199',
      domainId: '507f1f77bcf86cd799439188',
    });

    await expect(
      service.create({
        domainId: '507f1f77bcf86cd799439199',
        title: 'About Us',
        slug: 'about-us',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create a global page without domainId', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        title: 'Privacy Policy',
        slug: 'privacy-policy',
      }),
    ).resolves.toEqual(mockPage);
    expect(mockDomainsService.getActiveById).not.toHaveBeenCalled();
  });

  it('should default isTitleVisible to true when omitted on create', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await service.create({
      title: 'Privacy Policy',
      slug: 'privacy-policy',
    });

    expect(mockPageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        isTitleVisible: true,
      }),
    );
  });

  it('should allow setting homepage for a published domain page', async () => {
    mockPageModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      service.create({
        domainId: mockPage.domainId,
        title: 'Home',
        slug: 'home',
        status: PageStatus.Published,
        isHomepage: true,
      }),
    ).resolves.toEqual(mockPage);
  });

  it('should reject setting homepage for a draft page', async () => {
    await expect(
      service.create({
        title: 'Home',
        slug: 'home',
        isHomepage: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject duplicate domain homepage', async () => {
    mockPageModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...mockPage, isHomepage: true });

    await expect(
      service.create({
        domainId: mockPage.domainId,
        title: 'Home',
        slug: 'home',
        status: PageStatus.Published,
        isHomepage: true,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject duplicate global homepage', async () => {
    mockPageModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...mockGlobalPage, isHomepage: true });

    await expect(
      service.create({
        title: 'Home',
        slug: 'home',
        status: PageStatus.Published,
        isHomepage: true,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create a page with valid blocks', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          {
            id: 'intro',
            type: PageBlockType.RichText,
            description: '<p>Hello</p><script>alert(1)</script>',
            relatedPeople: {
              title: 'Authors',
              peopleIds: ['507f1f77bcf86cd799439221'],
            },
          },
          {
            id: 'team',
            type: PageBlockType.EntityCollection,
            entityType: EntityCollectionEntityType.People,
            layout: EntityCollectionLayout.Grid,
            items: ['507f1f77bcf86cd799439221'],
          },
          {
            id: 'apply',
            type: PageBlockType.ApplicationForm,
            applicationType: ApplicationFormType.General,
          },
        ],
      }),
    ).resolves.toEqual(mockPage);

    expect(mockPageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            id: 'intro',
            description: '<p>Hello</p>',
          }),
        ]),
      }),
    );
  });

  it('should reject unpublished media references in page blocks', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);
    mockMediaService.existingPublishedIds.mockResolvedValue(new Set());

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          {
            id: 'hero',
            type: PageBlockType.RichText,
            media: { mediaId: '507f1f77bcf86cd799439221' },
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject hero item external buttons without url at the service layer', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          {
            id: 'hero',
            type: PageBlockType.Hero,
            items: [
              {
                title: 'Card',
                button: {
                  label: 'Visit',
                  type: BlockButtonType.External,
                },
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should accept valid hero item buttons at the service layer', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          {
            id: 'hero',
            type: PageBlockType.Hero,
            items: [
              {
                title: 'Card',
                button: {
                  label: 'Visit',
                  type: BlockButtonType.External,
                  url: 'https://example.com/about',
                },
              },
            ],
          },
        ],
      }),
    ).resolves.toEqual(mockPage);
  });

  it('should reject cta blocks without buttons at the service layer', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          {
            id: 'apply',
            type: PageBlockType.Cta,
            buttons: [],
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject entity collections without items at the service layer', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          {
            id: 'team',
            type: PageBlockType.EntityCollection,
            entityType: EntityCollectionEntityType.People,
            layout: EntityCollectionLayout.Grid,
            items: [],
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject duplicate block ids', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          { id: 'dup', type: PageBlockType.Hero },
          {
            id: 'dup',
            type: PageBlockType.ApplicationForm,
            applicationType: ApplicationFormType.General,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject invalid relatedPeople without people ids', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          {
            id: 'intro',
            type: PageBlockType.RichText,
            relatedPeople: {
              title: 'Authors',
              peopleIds: [],
            },
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject wrong entityCollection refs', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);
    mockEventsService.existingIds.mockResolvedValue(new Set<string>());

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          {
            id: 'events',
            type: PageBlockType.EntityCollection,
            entityType: EntityCollectionEntityType.Events,
            layout: EntityCollectionLayout.List,
            items: ['507f1f77bcf86cd799439888'],
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return published pages for a valid public domain list query', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockPage]),
            }),
          }),
        }),
      }),
    });

    await expect(
      service.findAll({
        domainId: mockPage.domainId,
        limit: '10',
        offset: '0',
      }),
    ).resolves.toEqual([mockPage]);
  });

  it('should return isTitleVisible=true fallback in public domain listings', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([
                {
                  ...mockPage,
                  isTitleVisible: undefined,
                },
              ]),
            }),
          }),
        }),
      }),
    });

    await expect(
      service.findAll({
        domainId: mockPage.domainId,
      }),
    ).resolves.toEqual([expect.objectContaining({ isTitleVisible: true })]);
  });

  it('should throw NotFoundException for invalid public item ids', async () => {
    await expect(service.findOne('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should reject draft pages from public item reads', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(service.findOne(mockPage._id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return raw draft pages for admin reads', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          status: PageStatus.Draft,
          blocks: [{ id: 'intro', type: PageBlockType.RichText }],
        }),
      }),
    });

    await expect(service.findAdminOne(mockPage._id)).resolves.toEqual(
      expect.objectContaining({
        status: PageStatus.Draft,
        blocks: [{ id: 'intro', type: PageBlockType.RichText }],
      }),
    );
  });

  it('should bulk resolve draft admin pages without published filtering', async () => {
    const draftPage = {
      ...mockPage,
      _id: '507f1f77bcf86cd799439121',
      status: PageStatus.Draft,
      isTitleVisible: undefined,
    };
    const publishedPage = {
      ...mockGlobalPage,
      _id: '507f1f77bcf86cd799439122',
      status: PageStatus.Published,
    };
    mockPageModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([publishedPage, draftPage]),
      }),
    });

    const result = await service.findManyAdminByIds([
      draftPage._id,
      'invalid',
      publishedPage._id,
    ]);

    expect(mockPageModel.find).toHaveBeenCalledWith({
      _id: { $in: [draftPage._id, publishedPage._id] },
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          _id: draftPage._id,
          status: PageStatus.Draft,
          isTitleVisible: true,
        }),
        publishedPage,
      ],
    });
  });

  it('should return a published global page by slug', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGlobalPage),
      }),
    });

    await expect(
      service.findOneGlobalBySlug('privacy-policy'),
    ).resolves.toEqual(mockGlobalPage);
  });

  it('should reject unknown global page slugs', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(service.findOneGlobalBySlug('missing-page')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return published global homepage', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockGlobalPage,
          isHomepage: true,
        }),
      }),
    });

    await expect(service.findGlobalHomepage()).resolves.toEqual(
      expect.objectContaining({ isHomepage: true }),
    );
  });

  it('should reject missing global homepage', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(service.findGlobalHomepage()).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should list only global pages for admin global listing', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockGlobalPage]),
            }),
          }),
        }),
      }),
    });

    await expect(service.findAllGlobal()).resolves.toEqual([mockGlobalPage]);
  });

  it('should return isTitleVisible=true fallback in admin global listings', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([
                {
                  ...mockGlobalPage,
                  isTitleVisible: undefined,
                },
              ]),
            }),
          }),
        }),
      }),
    });

    await expect(service.findAllGlobal()).resolves.toEqual([
      expect.objectContaining({ isTitleVisible: true }),
    ]);
  });

  it('should return raw draft pages for admin global listing', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([
                {
                  ...mockGlobalPage,
                  status: PageStatus.Draft,
                  blocks: [
                    { id: 'hidden', type: PageBlockType.Cta, isVisible: false },
                  ],
                },
              ]),
            }),
          }),
        }),
      }),
    });

    await expect(service.findAllGlobal()).resolves.toEqual([
      expect.objectContaining({
        status: PageStatus.Draft,
        blocks: [{ id: 'hidden', type: PageBlockType.Cta, isVisible: false }],
      }),
    ]);
  });

  it('should list only pages for selected domain in admin domain listing', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest
                .fn()
                .mockResolvedValue([
                  mockPage,
                  { ...mockPage, _id: '507f1f77bcf86cd799439113' },
                ]),
            }),
          }),
        }),
      }),
    });

    await expect(
      service.findAllByDomainIdAdmin({
        domainId: String(mockPage.domainId),
      }),
    ).resolves.toEqual([
      mockPage,
      expect.objectContaining({ _id: '507f1f77bcf86cd799439113' }),
    ]);

    expect(mockDomainsService.getActiveById).toHaveBeenCalledWith(
      String(mockPage.domainId),
    );
    expect(mockPageModel.find).toHaveBeenCalledWith({
      domainId: String(mockPage.domainId),
    });
  });

  it('should list all pages in admin listing', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockGlobalPage, mockPage]),
            }),
          }),
        }),
      }),
    });

    await expect(service.findAllAdmin()).resolves.toEqual([
      mockGlobalPage,
      mockPage,
    ]);
    expect(mockPageModel.find).toHaveBeenCalledWith({});
  });

  it('should include draft pages in admin domain listing', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest
                .fn()
                .mockResolvedValue([{ ...mockPage, status: PageStatus.Draft }]),
            }),
          }),
        }),
      }),
    });

    await expect(
      service.findAllByDomainIdAdmin({
        domainId: String(mockPage.domainId),
      }),
    ).resolves.toEqual([expect.objectContaining({ status: PageStatus.Draft })]);
  });

  it('should list all domain-scoped pages when domainId is omitted', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockPage]),
            }),
          }),
        }),
      }),
    });

    await expect(service.findAllByDomainIdAdmin({})).resolves.toEqual([
      mockPage,
    ]);
    expect(mockDomainsService.getActiveById).not.toHaveBeenCalled();
    expect(mockPageModel.find).toHaveBeenCalledWith({
      domainId: { $exists: true },
    });
  });

  it('should reject duplicate slug among global pages', async () => {
    mockPageModel.findOne.mockResolvedValue(mockGlobalPage);

    await expect(
      service.create({
        title: 'Privacy Policy',
        slug: 'privacy-policy',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should return published pages by domain slug', async () => {
    mockPageModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockPage]),
            }),
          }),
        }),
      }),
    });

    await expect(service.findAllByDomainSlug('academy')).resolves.toEqual([
      mockPage,
    ]);
  });

  it('should omit hidden blocks and resolve related people on public reads', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          blocks: [
            {
              id: 'hidden',
              type: PageBlockType.Cta,
              isVisible: false,
              buttons: [],
            },
            {
              id: 'intro',
              type: PageBlockType.RichText,
              relatedPeople: {
                title: 'Authors',
                peopleIds: [
                  '507f1f77bcf86cd799439221',
                  '507f1f77bcf86cd799439222',
                ],
              },
            },
          ],
        }),
      }),
    });
    mockPeopleService.findPublishedSummariesByIds.mockResolvedValueOnce([
      {
        _id: '507f1f77bcf86cd799439221',
        fullName: 'Alice',
      },
    ]);

    await expect(service.findOne(mockPage._id)).resolves.toEqual(
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            id: 'intro',
            relatedPeople: expect.objectContaining({
              peopleIds: ['507f1f77bcf86cd799439221'],
              people: [{ _id: '507f1f77bcf86cd799439221', fullName: 'Alice' }],
            }),
          }),
        ],
      }),
    );
  });

  it('should omit relatedPeople section if no visible people remain', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          blocks: [
            {
              id: 'intro',
              type: PageBlockType.RichText,
              relatedPeople: {
                title: 'Authors',
                peopleIds: ['507f1f77bcf86cd799439221'],
              },
            },
          ],
        }),
      }),
    });
    mockPeopleService.findPublishedSummariesByIds.mockResolvedValueOnce([]);

    await expect(service.findOne(mockPage._id)).resolves.toEqual(
      expect.objectContaining({
        blocks: [
          expect.not.objectContaining({ relatedPeople: expect.anything() }),
        ],
      }),
    );
  });

  it('should return a published page by domain slug and page slug', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPage),
      }),
    });

    await expect(
      service.findOneByDomainSlugAndPageSlug('academy', 'about-us'),
    ).resolves.toEqual(mockPage);
  });

  it('should reject unknown page slug in a valid domain', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      service.findOneByDomainSlugAndPageSlug('academy', 'missing-page'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return published domain homepage', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          isHomepage: true,
        }),
      }),
    });

    await expect(service.findDomainHomepage('academy')).resolves.toEqual(
      expect.objectContaining({ isHomepage: true }),
    );
  });

  it('should reject missing domain homepage', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(service.findDomainHomepage('academy')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should reject update when slug already exists on another page', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPage),
      }),
    });
    mockPageModel.findOne.mockResolvedValue({
      ...mockGlobalPage,
      slug: 'privacy-policy',
    });

    await expect(
      service.update(mockPage._id, { slug: 'privacy-policy' }),
    ).rejects.toThrow(ConflictException);
    expect(mockPageModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('should reject update when homepage already exists in the same domain', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          isHomepage: false,
        }),
      }),
    });
    mockPageModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...mockPage,
      _id: '507f1f77bcf86cd799439119',
      isHomepage: true,
    });

    await expect(
      service.update(mockPage._id, { isHomepage: true }),
    ).rejects.toThrow(ConflictException);
    expect(mockPageModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('should reject draft status when page remains homepage', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          status: PageStatus.Published,
          isHomepage: true,
        }),
      }),
    });

    await expect(
      service.update(mockPage._id, { status: PageStatus.Draft }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should keep historical blocks unchanged and skip validators when patch omits blocks', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          blocks: [
            {
              id: 'legacy-collection',
              type: PageBlockType.EntityCollection,
              entityType: EntityCollectionEntityType.People,
              layout: EntityCollectionLayout.Grid,
              items: [],
              columns: '2',
            },
          ],
        }),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          title: 'Updated',
          blocks: [
            {
              id: 'legacy-collection',
              type: PageBlockType.EntityCollection,
              entityType: EntityCollectionEntityType.People,
              layout: EntityCollectionLayout.Grid,
              items: [],
              columns: '2',
            },
          ],
        }),
      }),
    });

    await service.update(mockPage._id, { title: 'Updated' });

    expect(mockPageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockPage._id,
      expect.not.objectContaining({
        blocks: expect.anything(),
        isTitleVisible: expect.anything(),
      }),
      { new: true },
    );
  });

  it('should patch isTitleVisible when explicitly provided', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          isTitleVisible: true,
        }),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          isTitleVisible: false,
        }),
      }),
    });

    await service.update(mockPage._id, { isTitleVisible: false });

    expect(mockPageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockPage._id,
      expect.objectContaining({
        isTitleVisible: false,
      }),
      { new: true },
    );
  });

  it('should return isTitleVisible=true fallback for legacy public pages', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockGlobalPage,
          isTitleVisible: undefined,
        }),
      }),
    });

    await expect(
      service.findOneGlobalBySlug('privacy-policy'),
    ).resolves.toEqual(expect.objectContaining({ isTitleVisible: true }));
  });

  it('should return isTitleVisible=true fallback for legacy admin page reads', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          isTitleVisible: undefined,
        }),
      }),
    });

    await expect(service.findAdminOne(mockPage._id)).resolves.toEqual(
      expect.objectContaining({ isTitleVisible: true }),
    );
  });

  it('should unset domainId when patch includes domainId null', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          domainId: mockPage.domainId,
        }),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockGlobalPage,
        }),
      }),
    });

    await service.update(mockPage._id, { domainId: null });

    expect(mockPageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockPage._id,
      expect.objectContaining({
        $unset: { domainId: 1 },
      }),
      { new: true },
    );
  });

  it('should replace full blocks array when patch includes blocks', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          blocks: [{ id: 'old', type: PageBlockType.Cta, buttons: [] }],
        }),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPage),
      }),
    });

    await service.update(mockPage._id, {
      blocks: [
        {
          id: 'new',
          type: PageBlockType.ApplicationForm,
          applicationType: ApplicationFormType.General,
        },
      ],
    });

    expect(mockPageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockPage._id,
      expect.objectContaining({
        blocks: [
          expect.objectContaining({
            id: 'new',
            type: PageBlockType.ApplicationForm,
          }),
        ],
      }),
      { new: true, runValidators: true },
    );
  });

  it.each([
    [
      'validation',
      new mongoose.Error.ValidationError(),
      'Update validation failed',
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
    'maps Mongoose %s errors from validated block updates to HTTP 400',
    async (_name, persistenceError, expectedMessage) => {
      mockPageModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockPage, blocks: [] }),
        }),
      });
      mockPageModel.findOne.mockResolvedValue(null);
      mockPageModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(persistenceError),
        }),
      });

      const result = service.update(mockPage._id, {
        blocks: [{ id: 'rich', type: PageBlockType.RichText }],
      });

      await expect(result).rejects.toMatchObject({
        message: expectedMessage,
        status: 400,
      });
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('reports a non-block validation path when blocks are updated together', async () => {
    const persistenceError = new mongoose.Error.ValidationError();
    persistenceError.addError(
      'title',
      new mongoose.Error.ValidatorError({ path: 'title' }),
    );
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockPage, blocks: [] }),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(persistenceError),
      }),
    });

    await expect(
      service.update(mockPage._id, {
        title: 'Updated title',
        blocks: [{ id: 'rich', type: PageBlockType.RichText }],
      }),
    ).rejects.toMatchObject({
      message: 'Update validation failed: title',
      status: 400,
    });
  });

  it('preserves unknown persistence failures from validated block updates', async () => {
    const persistenceError = new Error('database unavailable');
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockPage, blocks: [] }),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(persistenceError),
      }),
    });

    await expect(
      service.update(mockPage._id, {
        blocks: [{ id: 'rich', type: PageBlockType.RichText }],
      }),
    ).rejects.toBe(persistenceError);
  });

  it('does not remap Mongoose validation errors for metadata-only updates', async () => {
    const persistenceError = new mongoose.Error.ValidationError();
    persistenceError.addError(
      'title',
      new mongoose.Error.ValidatorError({ path: 'title' }),
    );
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockPage, blocks: [] }),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue(persistenceError),
      }),
    });

    await expect(
      service.update(mockPage._id, { title: 'Updated title' }),
    ).rejects.toBe(persistenceError);
    expect(mockPageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockPage._id,
      expect.objectContaining({ title: 'Updated title' }),
      { new: true },
    );
  });

  it.each([
    ['RichText', [{ id: 'rich', type: PageBlockType.RichText }]],
    [
      'EntityCollection',
      [
        {
          id: 'collection',
          type: PageBlockType.EntityCollection,
          entityType: EntityCollectionEntityType.People,
          layout: EntityCollectionLayout.Grid,
          items: ['507f1f77bcf86cd799439221'],
        },
      ],
    ],
    [
      'Hero',
      [
        {
          id: 'hero',
          type: PageBlockType.Hero,
          items: [{ title: 'Card' }],
        },
      ],
    ],
    [
      'CTA with embedded modal block',
      [
        {
          id: 'cta',
          type: PageBlockType.Cta,
          buttons: [
            {
              label: 'Open',
              type: BlockButtonType.Block,
              block: {
                id: 'modal-collection',
                type: PageBlockType.EntityCollection,
                entityType: EntityCollectionEntityType.People,
                layout: EntityCollectionLayout.Grid,
                items: ['507f1f77bcf86cd799439221'],
              },
            },
          ],
        },
      ],
    ],
    [
      'Gallery',
      [
        {
          id: 'gallery',
          type: PageBlockType.Gallery,
          items: [{ mediaId: '507f1f77bcf86cd799439222' }],
        },
      ],
    ],
    [
      'ApplicationForm',
      [
        {
          id: 'application',
          type: PageBlockType.ApplicationForm,
          applicationType: ApplicationFormType.General,
        },
      ],
    ],
    [
      'HTML legacy defaults',
      [
        {
          id: 'html',
          type: PageBlockType.Html,
          content: '<p>Existing</p>',
        },
      ],
    ],
    [
      'Group',
      [
        {
          id: 'group',
          type: PageBlockType.Group,
          blocks: [{ id: 'group-rich', type: PageBlockType.RichText }],
        },
      ],
    ],
    [
      'mixed composition',
      [
        { id: 'mixed-rich', type: PageBlockType.RichText },
        {
          id: 'mixed-collection',
          type: PageBlockType.EntityCollection,
          entityType: EntityCollectionEntityType.People,
          layout: EntityCollectionLayout.Grid,
          items: ['507f1f77bcf86cd799439221'],
        },
        {
          id: 'mixed-group',
          type: PageBlockType.Group,
          blocks: [{ id: 'mixed-group-rich', type: PageBlockType.RichText }],
        },
      ],
    ],
  ] as const)(
    'keeps existing %s content editable when Page block update validators are enabled',
    async (_name, blocks) => {
      mockPageModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...mockPage, blocks }),
        }),
      });
      mockPageModel.findOne.mockResolvedValue(null);
      mockPageModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockPage),
        }),
      });
      const edited = blocks.map((block, index) =>
        index === 0 ? { ...block, title: 'Edited' } : block,
      );

      await service.update(mockPage._id, {
        blocks: edited as never,
      });

      expect(mockPageModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockPage._id,
        expect.objectContaining({ blocks: expect.any(Array) }),
        { new: true, runValidators: true },
      );
      const savedBlocks = mockPageModel.findByIdAndUpdate.mock.calls[0][1]
        .blocks as Array<Record<string, unknown>>;
      expect(savedBlocks[0].title).toBe('Edited');
      if (savedBlocks[0].type === PageBlockType.EntityCollection) {
        expect(savedBlocks[0]).not.toHaveProperty('columns');
      }
    },
  );

  it('preserves existing HTML snippets when an old-shaped page update omits them', async () => {
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
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
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
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPage),
      }),
    });

    await service.update(mockPage._id, {
      blocks: [
        {
          id: 'html',
          type: PageBlockType.Html,
          template: 'vertical',
          content: marker,
        },
      ],
    });

    expect(mockPageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockPage._id,
      expect.objectContaining({
        blocks: [expect.objectContaining({ snippets: savedSnippets })],
      }),
      { new: true, runValidators: true },
    );
  });

  it('rejects an old-shaped page update when stored block ids make preservation ambiguous', async () => {
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
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          blocks: [storedHtmlBlock, storedHtmlBlock],
        }),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);

    await expect(
      service.update(mockPage._id, {
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
    expect(mockPageModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('treats an explicit empty HTML snippet list as an intentional clear', async () => {
    const marker =
      '<span data-dom-html-snippet="button" data-dom-html-snippet-id="saved"></span>';
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          blocks: [
            {
              id: 'html',
              type: PageBlockType.Html,
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
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPage),
      }),
    });

    await service.update(mockPage._id, {
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

    expect(mockPageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockPage._id,
      expect.objectContaining({
        blocks: [expect.objectContaining({ snippets: [] })],
      }),
      { new: true, runValidators: true },
    );
  });

  it('should throw when update result is unexpectedly null', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPage),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      service.update(mockPage._id, { title: 'Updated' }),
    ).rejects.toThrow(NotFoundException);
  });
  it('returns Random preview metadata with normalized persisted/draft identity', async () => {
    mockPeopleService.findDynamicPreviewItems.mockResolvedValue([
      { id: 'selected', label: 'Selected' },
    ]);
    for (const owner of [
      { kind: 'persistedPage' as const, pageId: mockPage._id },
      {
        kind: 'draftPage' as const,
        draftToken: 'a44a9bc6-534f-4eb5-97c1-1de29a5ec294',
      },
    ]) {
      const result = await service.previewEntityCollection({
        entityType: EntityCollectionEntityType.People,
        filters: {},
        contextDomainId: mockPage.domainId,
        itemOrder: EntityCollectionItemOrder.Random,
        blockId: 'child',
        blockPath: ['parent', 'child'],
        owner,
      });
      const context =
        mockPeopleService.findDynamicPreviewItems.mock.calls.at(-1)?.[2];
      expect(result).toEqual({
        items: [{ id: 'selected', label: 'Selected' }],
        orderBucket: new Date().toISOString().slice(0, 10),
      });
      expect(context).toEqual(
        createRandomOrdering(
          {
            now: new Date(),
            domainId: mockPage.domainId,
            owner:
              owner.kind === 'persistedPage'
                ? { kind: 'page', pageId: mockPage._id }
                : owner,
            blockPath: ['parent', 'child'],
          },
          'people',
        ),
      );
    }
  });

  it('keeps repeated admin Random previews fresh', async () => {
    mockPeopleService.findDynamicPreviewItems.mockResolvedValue([
      { id: 'a', label: 'A' },
    ]);
    const request = {
      entityType: EntityCollectionEntityType.People as const,
      filters: {},
      contextDomainId: null,
      itemOrder: EntityCollectionItemOrder.Random as const,
      blockPath: ['fresh-preview'],
      owner: { kind: 'page' as const, pageId: mockPage._id },
    };
    const before = mockPeopleService.findDynamicPreviewItems.mock.calls.length;
    await service.previewEntityCollection(request);
    await service.previewEntityCollection(request);
    expect(mockPeopleService.findDynamicPreviewItems).toHaveBeenCalledTimes(
      before + 2,
    );
  });

  it('supplies persisted Page owner and ancestor path to public Random resolution', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: () => ({
        exec: async () => ({
          ...mockPage,
          blocks: [
            {
              id: 'group',
              type: 'group',
              blocks: [
                {
                  id: 'child',
                  type: 'entityCollection',
                  entityType: 'people',
                  source: 'dynamic',
                  layout: 'grid',
                  items: [],
                  filters: {},
                  itemOrder: 'random',
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
    await service.findOne(mockPage._id);
    const context =
      mockPeopleService.findDynamicSummaries.mock.calls.at(-1)?.[2];
    expect(context).toEqual(
      createRandomOrdering(
        {
          now: new Date(),
          domainId: mockPage.domainId,
          owner: { kind: 'page', pageId: mockPage._id },
          blockPath: ['group', 'child'],
        },
        'people',
      ),
    );
  });
});
