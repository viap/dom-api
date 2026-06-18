import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
import { BulkResolveResponse } from '@/common/types/bulk-resolve.types';
import {
  prepareBulkIds,
  toBulkResolveResponse,
} from '@/common/utils/bulk-resolve';
import { resolveExistingIds } from '@/common/utils/resolve-ids';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { DomainsService } from '@/domains/domains.service';
import { EventsService } from '@/events/events.service';
import { MediaService } from '@/media/media.service';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PageStatus } from './enums/page-status.enum';
import { PageQueryParams } from './types/query-params.interface';
import { Page, PageDocument } from './schemas/page.schema';
import { PageBlock } from './types/page-block.interface';
import {
  BlockValidationServices,
  prepareBlocksForWrite,
  toPublicBlocks,
} from './utils/block-validation';

type PageReference = {
  _id: mongoose.Types.ObjectId | string;
  slug: string;
  domainId?: mongoose.Types.ObjectId | string;
  status?: PageStatus;
};

type PublicPageSource = {
  blocks?: Array<PageBlock | Record<string, unknown>>;
} & Record<string, unknown>;

@Injectable()
export class PagesService {
  constructor(
    @InjectModel(Page.name) private pageModel: Model<PageDocument>,
    private domainsService: DomainsService,
    private peopleService: PeopleService,
    private partnersService: PartnersService,
    private eventsService: EventsService,
    private mediaService: MediaService,
  ) {}

  async create(createPageDto: CreatePageDto): Promise<PageDocument> {
    if (createPageDto.domainId) {
      await this.domainsService.getActiveById(createPageDto.domainId);
    }
    const status = createPageDto.status || PageStatus.Draft;
    const isHomepage = createPageDto.isHomepage === true;
    const isTitleVisible = createPageDto.isTitleVisible !== false;

    this.ensurePublishedHomepage(status, isHomepage);
    await this.ensureUniqueSlug(createPageDto.slug);
    if (isHomepage) {
      await this.ensureUniqueHomepage(createPageDto.domainId);
    }

    const normalizedBlocks = await prepareBlocksForWrite(
      createPageDto.blocks || [],
      this.getBlockValidationServices(),
    );

    const page = new this.pageModel({
      ...createPageDto,
      isTitleVisible,
      blocks: normalizedBlocks,
    });
    return page.save();
  }

  async findAll(queryParams: PageQueryParams = {}): Promise<PageDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const domainId =
      typeof safeParams.domainId === 'string' ? safeParams.domainId : null;
    if (!domainId) {
      throw new BadRequestException('domainId is required');
    }

    await this.domainsService.getActiveById(domainId);

    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);

    const pages = await this.pageModel
      .find({
        domainId,
        status: PageStatus.Published,
      })
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    return Promise.all(pages.map((page) => this.toPublicPage(page)));
  }

  async findAllByDomainSlug(
    domainSlug: string,
    queryParams: { limit?: string; offset?: string } = {},
  ): Promise<PageDocument[]> {
    const domain = await this.domainsService.getActiveBySlug(domainSlug);
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);

    const pages = await this.pageModel
      .find({
        domainId: domain._id,
        status: PageStatus.Published,
      })
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    return Promise.all(pages.map((page) => this.toPublicPage(page)));
  }

  async findOne(id: string): Promise<PageDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid page ID format');
    }

    const page = await this.pageModel
      .findOne({ _id: validId, status: PageStatus.Published })
      .lean()
      .exec();
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toPublicPage(page);
  }

  async findManyByIds(
    ids: string[],
  ): Promise<BulkResolveResponse<PageDocument>> {
    const preparedIds = prepareBulkIds(ids);
    if (!preparedIds.validIds.length) {
      return {
        items: [],
      };
    }

    const pages = await this.pageModel
      .find({
        _id: { $in: preparedIds.validIds },
        status: PageStatus.Published,
      })
      .lean()
      .exec();

    const publicPages = await Promise.all(
      pages.map((page) => this.toPublicPage(page)),
    );

    return toBulkResolveResponse({
      preparedIds,
      items: publicPages,
      getId: (page) => page._id.toString(),
    });
  }

  async findOneByDomainSlugAndPageSlug(
    domainSlug: string,
    pageSlug: string,
  ): Promise<PageDocument> {
    const domain = await this.domainsService.getActiveBySlug(domainSlug);

    const page = await this.pageModel
      .findOne({
        domainId: domain._id,
        slug: pageSlug,
        status: PageStatus.Published,
      })
      .lean()
      .exec();
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toPublicPage(page);
  }

  async findOneGlobalBySlug(pageSlug: string): Promise<PageDocument> {
    const page = await this.pageModel
      .findOne({
        slug: pageSlug,
        status: PageStatus.Published,
        domainId: { $exists: false },
      })
      .lean()
      .exec();
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toPublicPage(page);
  }

  async findGlobalHomepage(): Promise<PageDocument> {
    const page = await this.pageModel
      .findOne({
        status: PageStatus.Published,
        isHomepage: true,
        domainId: { $exists: false },
      })
      .lean()
      .exec();
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toPublicPage(page);
  }

  async findDomainHomepage(domainSlug: string): Promise<PageDocument> {
    const domain = await this.domainsService.getActiveBySlug(domainSlug);

    const page = await this.pageModel
      .findOne({
        domainId: domain._id,
        status: PageStatus.Published,
        isHomepage: true,
      })
      .lean()
      .exec();
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toPublicPage(page);
  }

  async findAllGlobal(
    queryParams: {
      limit?: string;
      offset?: string;
    } = {},
  ): Promise<PageDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);

    const pages = await this.pageModel
      .find({
        domainId: { $exists: false },
      })
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    return pages.map((page) =>
      this.normalizePageTitleVisibility(page as Record<string, unknown>),
    );
  }

  async findAllAdmin(
    queryParams: {
      limit?: string;
      offset?: string;
    } = {},
  ): Promise<PageDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);

    const pages = await this.pageModel
      .find({})
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    return pages.map((page) =>
      this.normalizePageTitleVisibility(page as Record<string, unknown>),
    );
  }

  async findAllByDomainIdAdmin(queryParams: {
    domainId?: string;
    limit?: string;
    offset?: string;
  }): Promise<PageDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const domainId =
      typeof safeParams.domainId === 'string' ? safeParams.domainId : null;
    const filter: Record<string, unknown> = {};

    if (domainId) {
      await this.domainsService.getActiveById(domainId);
      filter.domainId = domainId;
    } else {
      filter.domainId = { $exists: true };
    }

    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);

    const pages = await this.pageModel
      .find(filter)
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();

    return pages.map((page) =>
      this.normalizePageTitleVisibility(page as Record<string, unknown>),
    );
  }

  async findAdminOne(id: string): Promise<PageDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid page ID format');
    }

    const page = await this.pageModel.findById(validId).lean().exec();
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.normalizePageTitleVisibility(page as Record<string, unknown>);
  }

  async update(
    id: string,
    updatePageDto: UpdatePageDto,
  ): Promise<PageDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid page ID format');
    }

    const existingPage = await this.pageModel.findById(validId).lean().exec();
    if (!existingPage) {
      throw new NotFoundException('Page not found');
    }

    const hasDomainIdField = Object.prototype.hasOwnProperty.call(
      updatePageDto,
      'domainId',
    );
    const domainId = hasDomainIdField
      ? updatePageDto.domainId || undefined
      : existingPage.domainId?.toString();
    const slug = updatePageDto.slug || existingPage.slug;
    const status = updatePageDto.status || existingPage.status;
    const hasIsHomepageField = Object.prototype.hasOwnProperty.call(
      updatePageDto,
      'isHomepage',
    );
    const isHomepage = hasIsHomepageField
      ? updatePageDto.isHomepage === true
      : existingPage.isHomepage === true;
    const hasIsTitleVisibleField = Object.prototype.hasOwnProperty.call(
      updatePageDto,
      'isTitleVisible',
    );

    this.ensurePublishedHomepage(status, isHomepage);

    if (domainId) {
      await this.domainsService.getActiveById(domainId);
    }
    await this.ensureUniqueSlug(slug, validId);
    if (isHomepage) {
      await this.ensureUniqueHomepage(domainId, validId);
    }
    const normalizedBlocks =
      updatePageDto.blocks !== undefined
        ? await prepareBlocksForWrite(
            updatePageDto.blocks,
            this.getBlockValidationServices(),
          )
        : undefined;

    const updateData: Record<string, unknown> = {};
    if (updatePageDto.slug !== undefined) {
      updateData.slug = updatePageDto.slug;
    }
    if (updatePageDto.title !== undefined) {
      updateData.title = updatePageDto.title;
    }
    if (updatePageDto.status !== undefined) {
      updateData.status = updatePageDto.status;
    }
    if (hasIsHomepageField) {
      updateData.isHomepage = isHomepage;
    }
    if (hasIsTitleVisibleField) {
      updateData.isTitleVisible = updatePageDto.isTitleVisible !== false;
    }
    if (updatePageDto.seo !== undefined) {
      updateData.seo = updatePageDto.seo;
    }
    if (hasDomainIdField && domainId) {
      updateData.domainId = domainId;
    } else if (hasDomainIdField) {
      updateData.$unset = { domainId: 1 };
    }
    if (normalizedBlocks !== undefined) {
      updateData.blocks = normalizedBlocks;
    }

    const page = await this.pageModel
      .findByIdAndUpdate(validId, updateData, { new: true })
      .lean()
      .exec();

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.normalizePageTitleVisibility(page as Record<string, unknown>);
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid page ID format');
    }

    const result = await this.pageModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Page not found');
    }

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.pageModel.countDocuments({ _id: validId });
    return count > 0;
  }

  private async ensureUniqueSlug(
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.pageModel.findOne(query);
    if (existing) {
      throw new ConflictException('Page with this slug already exists');
    }
  }

  private ensurePublishedHomepage(
    status: PageStatus,
    isHomepage: boolean,
  ): void {
    if (isHomepage && status !== PageStatus.Published) {
      throw new BadRequestException(
        'Only published pages can be designated as homepage',
      );
    }
  }

  private async ensureUniqueHomepage(
    domainId: string | undefined,
    excludeId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = domainId
      ? { domainId, isHomepage: true }
      : { isHomepage: true, domainId: { $exists: false } };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.pageModel.findOne(query);
    if (existing) {
      throw new ConflictException(
        domainId
          ? 'Homepage already exists for this domain'
          : 'Global homepage already exists',
      );
    }
  }

  private getBlockValidationServices(): BlockValidationServices {
    return {
      peopleExistingIds: (ids) => this.peopleService.existingIds(ids),
      partnersExistingIds: (ids) => this.partnersService.existingIds(ids),
      eventsExistingIds: (ids) => this.eventsService.existingIds(ids),
      mediaExistingPublishedIds: (ids) =>
        this.mediaService.existingPublishedIds(ids),
      pagesExistingIds: (ids) => this.existingIds(ids),
      domainsGetActiveById: (id) => this.domainsService.getActiveById(id),
    };
  }

  async existingIds(ids: string[]): Promise<Set<string>> {
    return resolveExistingIds(this.pageModel, ids);
  }

  async findReferenceById(id: string): Promise<PageReference | null> {
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }

    const page = await this.pageModel
      .findById(validId)
      .select({ _id: 1, slug: 1, domainId: 1, status: 1 })
      .lean()
      .exec();

    return page ? this.toPageReference(page) : null;
  }

  async findPublishedReferenceById(id: string): Promise<PageReference | null> {
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }

    const page = await this.pageModel
      .findOne({ _id: validId, status: PageStatus.Published })
      .select({ _id: 1, slug: 1, domainId: 1, status: 1 })
      .lean()
      .exec();

    return page ? this.toPageReference(page) : null;
  }

  private async toPublicPage(page: PublicPageSource): Promise<PageDocument> {
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const publicBlocks = await toPublicBlocks(blocks, {
      findPublishedPeopleSummariesByIds: (ids) =>
        this.peopleService.findPublishedSummariesByIds(ids),
    });

    return this.normalizePageTitleVisibility({
      ...(page as unknown as PageDocument),
      blocks: publicBlocks as mongoose.Types.Array<PageBlock>,
    } as unknown as Record<string, unknown>);
  }

  private normalizePageTitleVisibility(
    page: Record<string, unknown>,
  ): PageDocument {
    return {
      ...(page as unknown as PageDocument),
      isTitleVisible: page.isTitleVisible === false ? false : true,
    } as PageDocument;
  }

  private toPageReference(page: Record<string, unknown>): PageReference {
    return {
      _id: page._id as mongoose.Types.ObjectId | string,
      slug: page.slug as string,
      domainId: page.domainId as mongoose.Types.ObjectId | string | undefined,
      status: page.status as PageStatus | undefined,
    };
  }
}
