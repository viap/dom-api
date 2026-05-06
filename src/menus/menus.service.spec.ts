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
    pageId: mockGlobalPage._id,
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
    jest.resetAllMocks();
    mockSave.mockResolvedValue({ toObject: () => mockMenu });
    mockMenuModel.mockImplementation(() => mockMenuInstance);

    mockDomainsService.findOne.mockResolvedValue(mockDomain);
    mockDomainsService.getActiveById.mockResolvedValue(mockDomain);
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

  it('should create a menu without key and title', async () => {
    mockMenuModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });

    await expect(service.create({ items: [] })).resolves.toMatchObject({
      key: 'main',
      title: 'Main Menu',
    });
  });

  it('should convert duplicate key db error to conflict', async () => {
    mockMenuModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    mockSave.mockRejectedValue({ code: 11000, keyPattern: { key: 1 } });

    await expect(service.create({ key: 'main', items: [] })).rejects.toThrow(
      ConflictException,
    );
  });

  it('should convert duplicate page db error to conflict', async () => {
    mockMenuModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    mockSave.mockRejectedValue({ code: 11000, keyPattern: { pageId: 1 } });

    await expect(
      service.create({ pageId: mockGlobalPage._id, items: [] }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject invalid pageId reference', async () => {
    mockMenuModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    mockPagesService.findReferenceById.mockResolvedValue(null);

    await expect(
      service.create({ pageId: '507f1f77bcf86cd799439099', items: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should resolve public global menu urls and omit broken items', async () => {
    const findOneMock = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockMenu,
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
    mockMenuModel.findOne = findOneMock as any;

    mockPagesService.findPublishedReferenceById.mockImplementation(
      async (id: string) => (id === mockGlobalPage._id ? mockGlobalPage : null),
    );

    const result = await service.findPublicGlobalByKey('main');
    expect(findOneMock).toHaveBeenCalledWith({
      key: 'main',
      isActive: true,
      pageId: { $exists: false },
    });
    expect(result.items).toHaveLength(1);
  });

  it('should return admin menu by pageId', async () => {
    mockMenuModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockMenu) }),
    });

    await expect(service.findByPageId(mockGlobalPage._id)).resolves.toMatchObject({
      _id: mockMenu._id,
    });
  });

  it('should not wipe items when patch omits items', async () => {
    mockMenuModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockMenu) }),
    });
    mockMenuModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    const updated = { ...mockMenu, title: 'Updated' };
    const findByIdAndUpdateExec = jest.fn().mockResolvedValue(updated);
    mockMenuModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: findByIdAndUpdateExec }),
    });

    await service.update(mockMenu._id, { title: 'Updated' });

    expect(mockMenuModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockMenu._id,
      { $set: { title: 'Updated' } },
      { new: true },
    );
  });

  it('should unset pageId and key when null is provided', async () => {
    mockMenuModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockMenu) }),
    });
    mockMenuModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    mockMenuModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockMenu, pageId: undefined, key: undefined }),
      }),
    });

    await service.update(mockMenu._id, { pageId: null, key: null });

    expect(mockMenuModel.findByIdAndUpdate).toHaveBeenCalledWith(
      mockMenu._id,
      { $unset: { key: 1, pageId: 1 } },
      { new: true },
    );
  });

  it('should convert duplicate conflict from update write', async () => {
    mockMenuModel.findById.mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockMenu) }),
    });
    mockMenuModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    mockMenuModel.findByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockRejectedValue({ code: 11000, keyPattern: { key: 1 } }),
      }),
    });

    await expect(service.update(mockMenu._id, { key: 'dup' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('should remove an existing menu', async () => {
    mockMenuModel.findByIdAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: mockMenu._id }),
    });

    await expect(service.remove(mockMenu._id)).resolves.toBe(true);
  });
});
