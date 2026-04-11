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
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { Domain, DomainDocument } from '@/domains/schemas/domain.schema';
import { Page, PageDocument } from '@/pages/schemas/page.schema';
import { PageStatus } from '@/pages/enums/page-status.enum';
import { CreateMenuDto, MenuItemDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuItemType } from './enums/menu-item-type.enum';
import { MenuAdminQueryParams } from './types/admin-query-params.interface';
import { Menu, MenuDocument } from './schemas/menu.schema';

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
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
    @InjectModel(Page.name) private pageModel: Model<PageDocument>,
  ) {}

  async create(createMenuDto: CreateMenuDto): Promise<ResolvedMenu> {
    await this.validateMenuPayload(createMenuDto);
    await this.ensureUniqueKey(createMenuDto.key, createMenuDto.domainId);

    const normalizedItems = this.normalizeItems(createMenuDto.items || []);
    const menu = new this.menuModel({
      ...createMenuDto,
      items: normalizedItems,
    });
    const saved = await menu.save();
    return this.toAdminMenu(saved.toObject());
  }

  async findAll(
    queryParams: MenuAdminQueryParams = {},
  ): Promise<ResolvedMenu[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = this.parseLimit(safeParams.limit);
    const offset = this.parseOffset(safeParams.offset);

    const query: Record<string, unknown> = {};
    if (typeof safeParams.key === 'string') {
      query.key = safeParams.key;
    }
    if (typeof safeParams.domainId === 'string') {
      const validId = validateObjectId(safeParams.domainId);
      if (!validId) {
        throw new BadRequestException('Invalid domain ID format');
      }
      query.domainId = validId;
    }
    if (safeParams.isGlobal === true || safeParams.isGlobal === 'true') {
      query.domainId = { $exists: false };
    }

    const menus = await this.menuModel
      .find(query)
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    const resolved = await Promise.all(menus.map((menu) => this.toAdminMenu(menu)));
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

  async findPublicGlobalByKey(key: string): Promise<ResolvedMenu> {
    const menu = await this.menuModel
      .findOne({ key, isActive: true, domainId: { $exists: false } })
      .lean()
      .exec();
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.toPublicMenu(menu);
  }

  async findPublicByDomainAndKey(
    domainSlug: string,
    key: string,
  ): Promise<ResolvedMenu> {
    const domain = await this.findActiveDomainBySlug(domainSlug);
    const menu = await this.menuModel
      .findOne({ key, isActive: true, domainId: domain._id })
      .lean()
      .exec();
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.toPublicMenu(menu);
  }

  async update(id: string, updateMenuDto: UpdateMenuDto): Promise<ResolvedMenu> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid menu ID format');
    }

    const existing = await this.menuModel.findById(validId).lean().exec();
    if (!existing) {
      throw new NotFoundException('Menu not found');
    }

    const hasDomainIdField = Object.prototype.hasOwnProperty.call(
      updateMenuDto,
      'domainId',
    );
    const domainId = hasDomainIdField
      ? updateMenuDto.domainId || undefined
      : existing.domainId?.toString();
    const key = updateMenuDto.key || existing.key;

    await this.validateMenuPayload({
      key,
      title: updateMenuDto.title || existing.title,
      domainId,
      isActive:
        typeof updateMenuDto.isActive === 'boolean'
          ? updateMenuDto.isActive
          : existing.isActive,
      items: updateMenuDto.items || (existing.items as unknown as MenuItemDto[]),
    });
    await this.ensureUniqueKey(key, domainId, validId);

    const updateData = {
      ...updateMenuDto,
    } as Record<string, unknown>;
    if (updateMenuDto.items) {
      updateData.items = this.normalizeItems(updateMenuDto.items);
    }
    if (hasDomainIdField && !domainId) {
      updateData.$unset = { domainId: 1 };
      delete updateData.domainId;
    }

    const menu = await this.menuModel
      .findByIdAndUpdate(validId, updateData, { new: true })
      .lean()
      .exec();

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
    key: string;
    title: string;
    domainId?: string;
    isActive?: boolean;
    items?: MenuItemDto[];
  }): Promise<void> {
    if (menu.domainId) {
      const domain = await this.findDomainById(menu.domainId).catch(() => null);
      if (!domain) {
        throw new BadRequestException(
          `Referenced domain not found: ${menu.domainId}`,
        );
      }
    }

    await this.validateItems(menu.items || []);
  }

  private async validateItems(
    items: MenuItemDto[],
    depth = 0,
  ): Promise<void> {
    if (depth > 1) {
      throw new BadRequestException('Menu items support only one level of nesting');
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
        const exists = await this.findDomainById(item.targetId).catch(() => null);
        if (!exists) {
          throw new BadRequestException(
            `Referenced domain not found: ${item.targetId}`,
          );
        }
      }

      if (item.type === MenuItemType.Page && item.targetId) {
        const exists = await this.findPageById(item.targetId);
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
    key: string,
    domainId?: string,
    excludeId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = domainId
      ? { key, domainId }
      : { key, domainId: { $exists: false } };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.menuModel.findOne(query);
    if (existing) {
      throw new ConflictException(
        domainId
          ? 'Menu with this key already exists in the domain'
          : 'Global menu with this key already exists',
      );
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
    const visibleItems = includeBroken ? items : items.filter((i) => i.isVisible !== false);
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

    const children = await this.resolveItems(item.children || [], includeBroken);
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
      return includeBroken ? null : null;
    }

    if (item.type === MenuItemType.Domain) {
      const domain = includeBroken
        ? await this.findDomainById(item.targetId).catch(() => null)
        : await this.findActiveDomainById(item.targetId).catch(() => null);
      if (!domain) {
        return null;
      }

      return `/${domain.slug}`;
    }

    if (item.type === MenuItemType.Page) {
      const page = includeBroken
        ? await this.findPageById(item.targetId)
        : await this.findPublishedPageById(item.targetId);
      if (!page) {
        return null;
      }

      if (page.domainId) {
        const domain = includeBroken
          ? await this.findDomainById(page.domainId.toString()).catch(() => null)
          : await this.findActiveDomainById(page.domainId.toString()).catch(
              () => null,
            );
        if (!domain) {
          return null;
        }

        return `/pages/domain/${domain.slug}/${page.slug}`;
      }

      return `/pages/global/${page.slug}`;
    }

    return null;
  }

  private async findDomainById(id: string): Promise<DomainDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid domain ID format');
    }

    const domain = await this.domainModel.findById(validId).lean().exec();
    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    return domain as DomainDocument;
  }

  private async findActiveDomainById(id: string): Promise<DomainDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid domain ID format');
    }

    const domain = await this.domainModel
      .findOne({ _id: validId, isActive: true })
      .lean()
      .exec();
    if (!domain) {
      throw new NotFoundException('Active domain not found');
    }

    return domain as DomainDocument;
  }

  private async findActiveDomainBySlug(slug: string): Promise<DomainDocument> {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug || !/^[a-z0-9-]+$/.test(trimmedSlug)) {
      throw new NotFoundException('Invalid domain slug format');
    }

    const domain = await this.domainModel
      .findOne({ slug: trimmedSlug, isActive: true })
      .lean()
      .exec();
    if (!domain) {
      throw new NotFoundException('Active domain not found');
    }

    return domain as DomainDocument;
  }

  private async findPageById(id: string): Promise<PageDocument | null> {
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }

    const page = await this.pageModel.findById(validId).lean().exec();
    return (page as PageDocument) || null;
  }

  private async findPublishedPageById(id: string): Promise<PageDocument | null> {
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }

    const page = await this.pageModel
      .findOne({ _id: validId, status: PageStatus.Published })
      .lean()
      .exec();
    return (page as PageDocument) || null;
  }

  private parseLimit(value: unknown): number {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 100) {
      return parsed;
    }

    return 20;
  }

  private parseOffset(value: unknown): number {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }

    return 0;
  }
}
