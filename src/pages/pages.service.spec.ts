import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from '@/events/events.service';
import { DomainsService } from '@/domains/domains.service';
import { MediaService } from '@/media/media.service';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
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
  };
  const mockPartnersService = { exists: jest.fn() };
  const mockEventsService = { exists: jest.fn() };
  const mockMediaService = { exists: jest.fn() };

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
    mockPartnersService.exists.mockResolvedValue(true);
    mockEventsService.exists.mockResolvedValue(true);
    mockMediaService.exists.mockResolvedValue(true);
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

  it('should allow the same slug in different domains', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        domainId: '507f1f77bcf86cd799439199',
        title: 'About Us',
        slug: 'about-us',
      }),
    ).resolves.toEqual(mockPage);
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

  it('should reject duplicate block ids', async () => {
    mockPageModel.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        title: 'About Us',
        slug: 'about-us',
        blocks: [
          { id: 'dup', type: PageBlockType.Cta, buttons: [] },
          { id: 'dup', type: PageBlockType.Hero },
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
    mockEventsService.exists.mockResolvedValue(false);

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

  it('should return a published global page by slug', async () => {
    mockPageModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGlobalPage),
      }),
    });

    await expect(service.findOneGlobalBySlug('privacy-policy')).resolves.toEqual(
      mockGlobalPage,
    );
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
    mockPeopleService.findOne
      .mockResolvedValueOnce({
        _id: '507f1f77bcf86cd799439221',
        fullName: 'Alice',
      })
      .mockRejectedValueOnce(new NotFoundException('Person not found'));

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
    mockPeopleService.findOne.mockRejectedValueOnce(
      new NotFoundException('Person not found'),
    );

    await expect(service.findOne(mockPage._id)).resolves.toEqual(
      expect.objectContaining({
        blocks: [expect.not.objectContaining({ relatedPeople: expect.anything() })],
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

  it('should keep blocks unchanged when patch omits blocks', async () => {
    mockPageModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          blocks: [{ id: 'intro', type: PageBlockType.RichText }],
        }),
      }),
    });
    mockPageModel.findOne.mockResolvedValue(null);
    mockPageModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockPage,
          title: 'Updated',
          blocks: [{ id: 'intro', type: PageBlockType.RichText }],
        }),
      }),
    });

    await service.update(mockPage._id, { title: 'Updated' });

    expect(mockPageModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockPage._id,
      expect.not.objectContaining({ blocks: expect.anything() }),
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
      { new: true },
    );
  });
});
