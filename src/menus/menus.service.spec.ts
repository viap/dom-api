import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainsService } from '@/domains/domains.service';
import { PagesService } from '@/pages/pages.service';
import { MenuItemType } from './enums/menu-item-type.enum';
import { Menu } from './schemas/menu.schema';
import { MenusService } from './menus.service';

describe('MenusService', () => {
  let service: MenusService;

  const mockDomain = {
    _id: '507f1f77bcf86cd799439012',
    slug: 'academy / training',
    isActive: true,
  };

  const mockPage = {
    _id: '507f1f77bcf86cd799439111',
    domainId: mockDomain._id,
    slug: 'about academy',
    status: 'published',
  };

  const mockGlobalPage = {
    _id: '507f1f77bcf86cd799439211',
    slug: 'privacy policy',
    status: 'published',
  };

  const mockMenu = {
    _id: '507f1f77bcf86cd799439311',
    key: 'main',
    title: 'Main Menu',
    isActive: true,
    schemaVersion: 1,
    items: [
      {
        id: 'item-1',
        title: 'Academy',
        type: MenuItemType.Domain,
        targetId: mockDomain._id,
        order: 0,
        isVisible: true,
        openInNewTab: false,
        children: [],
      },
      {
        id: 'item-2',
        title: 'Privacy Policy',
        type: MenuItemType.Page,
        targetId: mockGlobalPage._id,
        order: 1,
        isVisible: true,
        openInNewTab: false,
        children: [],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSave = jest.fn().mockResolvedValue({
    toObject: () => mockMenu,
  });
  const mockMenuInstance = { save: mockSave };
  const mockMenuModel = Object.assign(
    jest.fn().mockImplementation(() => mockMenuInstance),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    },
  );

  const mockDomainsService = {
    findOne: jest.fn(),
    getActiveById: jest.fn(),
    getActiveBySlug: jest.fn(),
  };

  const mockPagesService = {
    findReferenceById: jest.fn(),
    findPublishedReferenceById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenusService,
        { provide: getModelToken(Menu.name), useValue: mockMenuModel },
        { provide: DomainsService, useValue: mockDomainsService },
        { provide: PagesService, useValue: mockPagesService },
      ],
    }).compile();

    service = module.get<MenusService>(MenusService);
    jest.clearAllMocks();

    mockDomainsService.findOne.mockResolvedValue(mockDomain);
    mockDomainsService.getActiveById.mockResolvedValue(mockDomain);
    mockDomainsService.getActiveBySlug.mockResolvedValue(mockDomain);
    mockPagesService.findReferenceById.mockImplementation(async (id: string) =>
      id === mockPage._id || id === mockGlobalPage._id
        ? id === mockGlobalPage._id
          ? mockGlobalPage
          : mockPage
        : null,
    );
    mockPagesService.findPublishedReferenceById.mockImplementation(
      async (id: string) =>
        id === mockPage._id || id === mockGlobalPage._id
          ? id === mockGlobalPage._id
            ? mockGlobalPage
            : mockPage
          : null,
    );
  });

  it('should create a global menu', async () => {
    mockMenuModel.findOne.mockResolvedValue(null);

    await expect(
      service.create({
        key: 'main',
        title: 'Main Menu',
        items: [],
      }),
    ).resolves.toMatchObject({ key: 'main', title: 'Main Menu' });
  });

  it('should reject invalid domainId', async () => {
    mockMenuModel.findOne.mockResolvedValue(null);
    mockDomainsService.findOne.mockRejectedValue(new NotFoundException());

    await expect(
      service.create({
        key: 'main',
        title: 'Main Menu',
        domainId: '507f1f77bcf86cd799439099',
        items: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject duplicate global menu key', async () => {
    mockMenuModel.findOne.mockResolvedValue(mockMenu);

    await expect(
      service.create({
        key: 'main',
        title: 'Main Menu',
        items: [],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should validate external items require url', async () => {
    mockMenuModel.findOne.mockResolvedValue(null);

    await expect(
      service.create({
        key: 'footer',
        title: 'Footer',
        items: [
          {
            title: 'External',
            type: MenuItemType.External,
            order: 0,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject grandchildren', async () => {
    mockMenuModel.findOne.mockResolvedValue(null);

    await expect(
      service.create({
        key: 'footer',
        title: 'Footer',
        items: [
          {
            title: 'Parent',
            type: MenuItemType.External,
            url: 'https://example.com',
            order: 0,
            children: [
              {
                title: 'Child',
                type: MenuItemType.External,
                url: 'https://example.com/child',
                order: 0,
                children: [
                  {
                    title: 'Grandchild',
                    type: MenuItemType.External,
                    url: 'https://example.com/grandchild',
                    order: 0,
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should resolve public global menu urls and omit broken items', async () => {
    mockMenuModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockMenu,
          domainId: undefined,
          items: [
            ...mockMenu.items,
            {
              id: 'item-3',
              title: 'Broken page',
              type: MenuItemType.Page,
              targetId: '507f1f77bcf86cd799439299',
              order: 2,
              isVisible: true,
              openInNewTab: false,
              children: [],
            },
          ],
        }),
      }),
    });
    mockPagesService.findPublishedReferenceById.mockImplementation(
      async (id: string) => (id === mockGlobalPage._id ? mockGlobalPage : null),
    );

    const result = await service.findPublicGlobalByKey('main');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].resolvedUrl).toBe('/academy%20%2F%20training');
    expect(result.items[1].resolvedUrl).toBe('/privacy%20policy');
  });

  it('should show broken targets in admin responses', async () => {
    mockMenuModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockMenu,
          items: [
            {
              id: 'item-3',
              title: 'Broken page',
              type: MenuItemType.Page,
              targetId: '507f1f77bcf86cd799439299',
              order: 0,
              isVisible: true,
              openInNewTab: false,
              children: [],
            },
          ],
        }),
      }),
    });
    mockPagesService.findReferenceById.mockResolvedValue(null);

    const result = await service.findOne(mockMenu._id);
    expect(result.items[0].isBrokenTarget).toBe(true);
  });

  it('should throw for missing public domain menus', async () => {
    mockMenuModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      service.findPublicByDomainAndKey('academy', 'main'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should remove an existing menu', async () => {
    mockMenuModel.findByIdAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: mockMenu._id }),
    });

    await expect(service.remove(mockMenu._id)).resolves.toBe(true);
  });
});
