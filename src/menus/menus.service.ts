import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { DomainsService } from '@/domains/domains.service';
import { PagesService } from '@/pages/pages.service';
import { CreateMenuDto, MenuItemDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuItemType } from './enums/menu-item-type.enum';
import { Menu, MenuDocument } from './schemas/menu.schema';
import { MenuAdminQueryParams } from './types/admin-query-params.interface';

type ResolvedMenuItem = MenuItemDto & {
  resolvedUrl?: string;
  isBrokenTarget?: boolean;
};

type ResolvedMenu = Omit<MenuDocument, 'items'> & {
  items: ResolvedMenuItem[];
};

@Injectable()
export class MenusService {
  constructor(
    @InjectModel(Menu.name) private menuModel: Model<MenuDocument>,
    private domainsService: DomainsService,
    private pagesService: PagesService,
  ) {}

  async create(createMenuDto: CreateMenuDto): Promise<ResolvedMenu> {
    await this.validateMenuPayload(createMenuDto);

    await this.ensureUniqueKey(createMenuDto.key);
    await this.ensureUniquePageId(createMenuDto.pageId);

    const normalizedItems = this.normalizeItems(createMenuDto.items || []);
    const menu = new this.menuModel({
      ...createMenuDto,
      items: normalizedItems,
    });
    try {
      const saved = await menu.save();
      return this.toAdminMenu(saved.toObject());
    } catch (error) {
      this.rethrowDuplicateKeyError(error);
      throw error;
    }
  }

  async findAll(
    queryParams: MenuAdminQueryParams = {},
  ): Promise<ResolvedMenu[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);

    const query: Record<string, unknown> = {};
    if (typeof safeParams.key === 'string') {
      query.key = safeParams.key;
    }
    if (typeof safeParams.pageId === 'string') {
      const validId = validateObjectId(safeParams.pageId);
      if (!validId) {
        throw new BadRequestException('Invalid page ID format');
      }
      query.pageId = validId;
    }

    const menus = await this.menuModel
      .find(query)
      .sort({ updatedAt: -1, title: 1, key: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    const resolved = await Promise.all(
      menus.map((menu) => this.toAdminMenu(menu)),
    );
    return resolved;
  }

  async findOne(id: string): Promise<ResolvedMenu> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid menu ID format');
    }

    const menu = await this.menuModel.findById(validId).lean().exec();
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.toAdminMenu(menu);
  }

  async findByPageId(pageId: string): Promise<ResolvedMenu> {
    const validPageId = validateObjectId(pageId);
    if (!validPageId) {
      throw new NotFoundException('Invalid page ID format');
    }

    const menu = await this.menuModel
      .findOne({ pageId: validPageId })
      .lean()
      .exec();
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.toAdminMenu(menu);
  }

  async findPublicByPageId(pageId: string): Promise<ResolvedMenu> {
    const validPageId = validateObjectId(pageId);
    if (!validPageId) {
      throw new NotFoundException('Invalid page ID format');
    }

    const menu = await this.menuModel
      .findOne({ pageId: validPageId, isActive: true })
      .lean()
      .exec();
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.toPublicMenu(menu);
  }

  async findPublicGlobalByKey(key: string): Promise<ResolvedMenu> {
    const menu = await this.menuModel
      .findOne({ key, isActive: true, pageId: { $exists: false } })
      .lean()
      .exec();
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.toPublicMenu(menu);
  }

  async update(
    id: string,
    updateMenuDto: UpdateMenuDto,
  ): Promise<ResolvedMenu> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid menu ID format');
    }

    const existing = await this.menuModel.findById(validId).lean().exec();
    if (!existing) {
      throw new NotFoundException('Menu not found');
    }

    const hasPageIdField = Object.prototype.hasOwnProperty.call(
      updateMenuDto,
      'pageId',
    );
    const hasKeyField = Object.prototype.hasOwnProperty.call(
      updateMenuDto,
      'key',
    );
    const pageId = hasPageIdField
      ? updateMenuDto.pageId || undefined
      : existing.pageId?.toString();
    const key = hasKeyField ? updateMenuDto.key || undefined : existing.key;

    await this.validateMenuPayload({
      key,
      title: updateMenuDto.title ?? existing.title,
      pageId,
      isActive:
        typeof updateMenuDto.isActive === 'boolean'
          ? updateMenuDto.isActive
          : existing.isActive,
      items:
        updateMenuDto.items || (existing.items as unknown as MenuItemDto[]),
    });
    await this.ensureUniqueKey(key, validId);
    await this.ensureUniquePageId(pageId, validId);

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    if (hasKeyField) {
      if (updateMenuDto.key) {
        $set.key = updateMenuDto.key;
      } else {
        $unset.key = 1;
      }
    }
    if (updateMenuDto.title !== undefined) {
      $set.title = updateMenuDto.title;
    }
    if (updateMenuDto.isActive !== undefined) {
      $set.isActive = updateMenuDto.isActive;
    }
    if (updateMenuDto.items !== undefined) {
      $set.items = this.normalizeItems(updateMenuDto.items);
    }
    if (hasPageIdField) {
      if (pageId) {
        $set.pageId = pageId;
      } else {
        $unset.pageId = 1;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (Object.keys($set).length > 0) {
      updateData.$set = $set;
    }
    if (Object.keys($unset).length > 0) {
      updateData.$unset = $unset;
    }

    let menu: MenuDocument | null;
    try {
      menu = await this.menuModel
        .findByIdAndUpdate(validId, updateData, { new: true })
        .lean()
        .exec();
    } catch (error) {
      this.rethrowDuplicateKeyError(error);
      throw error;
    }

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.toAdminMenu(menu as MenuDocument);
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid menu ID format');
    }

    const result = await this.menuModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Menu not found');
    }

    return true;
  }

  private async validateMenuPayload(menu: {
    key?: string;
    title?: string;
    pageId?: string;
    isActive?: boolean;
    items?: MenuItemDto[];
  }): Promise<void> {
    if (menu.pageId) {
      const page = await this.pagesService.findReferenceById(menu.pageId);
      if (!page) {
        throw new BadRequestException(
          `Referenced page not found: ${menu.pageId}`,
        );
      }
    }

    await this.validateItems(menu.items || []);
  }

  private async validateItems(items: MenuItemDto[], depth = 0): Promise<void> {
    if (depth > 1) {
      throw new BadRequestException(
        'Menu items support only one level of nesting',
      );
    }

    for (const item of items) {
      if (item.type === MenuItemType.External) {
        if (!item.url || item.targetId) {
          throw new BadRequestException(
            'External menu item requires url and must not include targetId',
          );
        }
      }

      if (
        item.type === MenuItemType.Domain ||
        item.type === MenuItemType.Page
      ) {
        if (!item.targetId || item.url) {
          throw new BadRequestException(
            `${item.type} menu item requires targetId and must not include url`,
          );
        }
      }

      if (item.type === MenuItemType.Domain && item.targetId) {
        const exists = await this.domainsService
          .findOne(item.targetId)
          .catch(() => null);
        if (!exists) {
          throw new BadRequestException(
            `Referenced domain not found: ${item.targetId}`,
          );
        }
      }

      if (item.type === MenuItemType.Page && item.targetId) {
        const exists = await this.pagesService.findReferenceById(item.targetId);
        if (!exists) {
          throw new BadRequestException(
            `Referenced page not found: ${item.targetId}`,
          );
        }
      }

      if ((item.children || []).length > 0) {
        await this.validateItems(item.children || [], depth + 1);
      }
    }
  }

  private async ensureUniqueKey(
    key?: string,
    excludeId?: string,
  ): Promise<void> {
    if (!key) {
      return;
    }

    const query: Record<string, unknown> = { key };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.menuModel.findOne(query).select('_id').lean();
    if (existing) {
      throw new ConflictException('Menu with this key already exists');
    }
  }

  private async ensureUniquePageId(
    pageId?: string,
    excludeId?: string,
  ): Promise<void> {
    if (!pageId) {
      return;
    }

    const query: Record<string, unknown> = { pageId };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.menuModel.findOne(query).select('_id').lean();
    if (existing) {
      throw new ConflictException('Menu for this page already exists');
    }
  }

  private normalizeItems(items: MenuItemDto[]): MenuItemDto[] {
    return [...items]
      .map((item) => ({
        ...item,
        id: item.id || randomUUID(),
        isVisible: item.isVisible ?? true,
        openInNewTab: item.openInNewTab ?? false,
        children: this.normalizeChildren(item.children || []),
      }))
      .sort((a, b) => a.order - b.order);
  }

  private normalizeChildren(items: MenuItemDto[]): MenuItemDto[] {
    return [...items]
      .map((item) => ({
        ...item,
        id: item.id || randomUUID(),
        isVisible: item.isVisible ?? true,
        openInNewTab: item.openInNewTab ?? false,
        children: [],
      }))
      .sort((a, b) => a.order - b.order);
  }

  private async toAdminMenu(menu: MenuDocument): Promise<ResolvedMenu> {
    return {
      ...menu,
      items: await this.resolveItems(
        (menu.items as unknown as MenuItemDto[]) || [],
        true,
      ),
    } as ResolvedMenu;
  }

  private async toPublicMenu(menu: MenuDocument): Promise<ResolvedMenu> {
    return {
      ...menu,
      items: await this.resolveItems(
        (menu.items as unknown as MenuItemDto[]) || [],
        false,
      ),
    } as ResolvedMenu;
  }

  private async resolveItems(
    items: MenuItemDto[],
    includeBroken: boolean,
  ): Promise<ResolvedMenuItem[]> {
    const visibleItems = includeBroken
      ? items
      : items.filter((i) => i.isVisible !== false);
    const resolved = await Promise.all(
      visibleItems
        .sort((a, b) => a.order - b.order)
        .map((item) => this.resolveItem(item, includeBroken)),
    );

    return resolved.filter((item): item is ResolvedMenuItem => item !== null);
  }

  private async resolveItem(
    item: MenuItemDto,
    includeBroken: boolean,
  ): Promise<ResolvedMenuItem | null> {
    const resolvedUrl = await this.resolveUrl(item, includeBroken);
    if (!resolvedUrl && !includeBroken) {
      return null;
    }

    const children = await this.resolveItems(
      item.children || [],
      includeBroken,
    );
    return {
      ...item,
      id: item.id || randomUUID(),
      isVisible: item.isVisible ?? true,
      openInNewTab: item.openInNewTab ?? false,
      ...(resolvedUrl
        ? { resolvedUrl }
        : includeBroken
        ? { isBrokenTarget: true }
        : {}),
      children,
    };
  }

  private async resolveUrl(
    item: MenuItemDto,
    includeBroken: boolean,
  ): Promise<string | null> {
    if (item.type === MenuItemType.External) {
      return item.url || null;
    }

    if (!item.targetId) {
      return null;
    }

    if (item.type === MenuItemType.Domain) {
      const domain = includeBroken
        ? await this.domainsService.findOne(item.targetId).catch(() => null)
        : await this.domainsService
            .getActiveById(item.targetId)
            .catch(() => null);
      if (!domain) {
        return null;
      }

      return `/${encodeURIComponent(domain.slug)}`;
    }

    if (item.type === MenuItemType.Page) {
      const page = includeBroken
        ? await this.pagesService.findReferenceById(item.targetId)
        : await this.pagesService.findPublishedReferenceById(item.targetId);
      if (!page) {
        return null;
      }

      if (page.domainId) {
        const domain = includeBroken
          ? await this.domainsService
              .findOne(page.domainId.toString())
              .catch(() => null)
          : await this.domainsService
              .getActiveById(page.domainId.toString())
              .catch(() => null);
        if (!domain) {
          return null;
        }

        return `/${encodeURIComponent(domain.slug)}/${encodeURIComponent(
          page.slug,
        )}`;
      }

      return `/${encodeURIComponent(page.slug)}`;
    }

    return null;
  }

  private rethrowDuplicateKeyError(error: unknown): never | void {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    ) {
      const keyPattern =
        (error as { keyPattern?: Record<string, unknown> }).keyPattern || {};
      if (keyPattern.pageId) {
        throw new ConflictException('Menu for this page already exists');
      }
      if (keyPattern.key) {
        throw new ConflictException('Menu with this key already exists');
      }
      throw new ConflictException('Menu uniqueness constraint violated');
    }
  }
}
