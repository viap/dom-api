import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainsService } from '@/domains/domains.service';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        {
          provide: getModelToken(Page.name),
          useValue: mockPageModel,
        },
        { provide: DomainsService, useValue: mockDomainsService },
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
});
