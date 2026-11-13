import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { permuteItems, type RandomOrdering } from '@/common/utils/ranked-query';
import { EntityCollectionItemOrder } from '@/pages/enums/entity-collection-item-order.enum';
import { EntityCollectionPreviewOwner } from '@/pages/types/page-block.interface';
import {
  createRandomOrdering,
  orderBucket,
} from '@/pages/utils/entity-collection-ordering';
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
import { formatMongooseUpdateValidationError } from '@/common/utils/mongoose-validation-error';
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
import { PageBlock, PageRootBlock } from './types/page-block.interface';
import { EntityCollectionEntityType } from './enums/entity-collection-entity-type.enum';
import { PeopleEntityCollectionFilters } from '@/people/types/entity-collection-filters.interface';
import { PartnerEntityCollectionFilters } from '@/partners/types/entity-collection-filters.interface';
import { EventEntityCollectionFilters } from '@/events/types/entity-collection-filters.interface';
import {
  BlockValidationServices,
  prepareBlocksForWrite,
  toPublicBlocks,
} from './utils/block-validation';
import { preserveOmittedHtmlSnippets } from './utils/html-snippet-preservation';
import { collectStoredEventCollections } from './utils/event-collection-identity';
import { EventCollectionSnapshot } from './types/event-collection-snapshot.interface';

const EVENT_SNAPSHOT_PAGE_CANDIDATE_LIMIT = 1000;

type PageReference = {
  _id: mongoose.Types.ObjectId | string;
  slug: string;
  domainId?: mongoose.Types.ObjectId | string;
  status?: PageStatus;
};

type PublicPageSource = {
  blocks?: Array<PageBlock | Record<string, unknown>>;
} & Record<string, unknown>;

export type EntityCollectionPreviewInput = (
  | {
      itemOrder: EntityCollectionItemOrder.Random;
      blockId?: string;
      blockPath: string[];
      owner: EntityCollectionPreviewOwner;
    }
  | {
      itemOrder?: EntityCollectionItemOrder.Default;
      blockId?: string;
      blockPath?: string[];
      owner?: EntityCollectionPreviewOwner;
    }
) &
  (
    | {
        entityType: EntityCollectionEntityType.People;
        filters: PeopleEntityCollectionFilters;
        limit?: number;
        contextDomainId: string | null;
      }
    | {
        entityType: EntityCollectionEntityType.Partners;
        filters: PartnerEntityCollectionFilters;
        limit?: number;
        contextDomainId: string | null;
      }
    | {
        entityType: EntityCollectionEntityType.Events;
        filters: EventEntityCollectionFilters;
        limit?: number;
        contextDomainId: string | null;
      }
  );

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

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
      { kind: 'page', nextStatus: status },
    );

    const page = new this.pageModel({
      ...createPageDto,
      isTitleVisible,
      blocks: normalizedBlocks,
    });
    return page.save();
  }

  async findAll(
    queryParams: PageQueryParams = {},
    signal?: AbortSignal,
  ): Promise<PageDocument[]> {
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

    return Promise.all(pages.map((page) => this.toPublicPage(page, signal)));
  }

  async findAllByDomainSlug(
    domainSlug: string,
    queryParams: { limit?: string; offset?: string } = {},
    signal?: AbortSignal,
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

    return Promise.all(pages.map((page) => this.toPublicPage(page, signal)));
  }

  async findOne(id: string, signal?: AbortSignal): Promise<PageDocument> {
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

    return this.toPublicPage(page, signal);
  }

  async findManyByIds(
    ids: string[],
    signal?: AbortSignal,
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
      pages.map((page) => this.toPublicPage(page, signal)),
    );

    return toBulkResolveResponse({
      preparedIds,
      items: publicPages,
      getId: (page) => page._id.toString(),
    });
  }

  async findManyAdminByIds(
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
      })
      .lean()
      .exec();

    const normalizedPages = pages.map((page) =>
      this.normalizePageTitleVisibility(page as Record<string, unknown>),
    );

    return toBulkResolveResponse({
      preparedIds,
      items: normalizedPages,
      getId: (page) => page._id.toString(),
    });
  }

  async findOneByDomainSlugAndPageSlug(
    domainSlug: string,
    pageSlug: string,
    signal?: AbortSignal,
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

    return this.toPublicPage(page, signal);
  }

  async findOneGlobalBySlug(
    pageSlug: string,
    signal?: AbortSignal,
  ): Promise<PageDocument> {
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

    return this.toPublicPage(page, signal);
  }

  async findGlobalHomepage(signal?: AbortSignal): Promise<PageDocument> {
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

    return this.toPublicPage(page, signal);
  }

  async findDomainHomepage(
    domainSlug: string,
    signal?: AbortSignal,
  ): Promise<PageDocument> {
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

    return this.toPublicPage(page, signal);
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
    const shouldRevalidateBlocksForPublication =
      updatePageDto.blocks === undefined &&
      existingPage.status !== PageStatus.Published &&
      status === PageStatus.Published;
    const blocksForWrite =
      updatePageDto.blocks !== undefined
        ? preserveOmittedHtmlSnippets(
            updatePageDto.blocks,
            Array.isArray(existingPage.blocks) ? existingPage.blocks : [],
          )
        : shouldRevalidateBlocksForPublication
        ? ((existingPage.blocks || []) as PageRootBlock[])
        : undefined;
    const normalizedBlocks =
      blocksForWrite !== undefined
        ? await prepareBlocksForWrite(
            blocksForWrite,
            this.getBlockValidationServices(),
            {
              kind: 'page',
              currentPageId: validId.toString(),
              previousBlocks: Array.isArray(existingPage.blocks)
                ? (existingPage.blocks as PageRootBlock[])
                : [],
              previousStatus: existingPage.status,
              nextStatus: status,
            },
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
    if (updatePageDto.blocks !== undefined && normalizedBlocks !== undefined) {
      updateData.blocks = normalizedBlocks;
    }

    let page: unknown;
    try {
      page = await this.pageModel
        .findByIdAndUpdate(validId, updateData, {
          new: true,
          ...(updatePageDto.blocks !== undefined
            ? { runValidators: true }
            : {}),
        })
        .lean()
        .exec();
    } catch (error) {
      if (updatePageDto.blocks !== undefined) {
        const message = formatMongooseUpdateValidationError(error);
        if (message) {
          throw new BadRequestException(message);
        }
      }
      throw error;
    }

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
      anchorPagesByIds: (ids) => this.findPublishedAnchorTargetPages(ids),
    };
  }

  private async findPublishedAnchorTargetPages(
    ids: string[],
  ): Promise<Array<{ id: string; blocks: PageRootBlock[] }>> {
    const { validIds } = prepareBulkIds(ids);
    if (!validIds.length) return [];

    const pages = await this.pageModel
      .find({ _id: { $in: validIds }, status: PageStatus.Published })
      .select({ _id: 1, domainId: 1, blocks: 1 })
      .lean()
      .exec();
    const domainIds = Array.from(
      new Set(
        pages
          .map((page) => page.domainId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const activeDomainIds = new Set(
      domainIds.length
        ? (await this.domainsService.findManyByIds(domainIds)).items.map(
            (domain) => domain._id.toString(),
          )
        : [],
    );

    return pages
      .filter(
        (page) =>
          !page.domainId || activeDomainIds.has(page.domainId.toString()),
      )
      .map((page) => ({
        id: page._id.toString(),
        blocks: Array.isArray(page.blocks)
          ? (page.blocks as PageRootBlock[])
          : [],
      }));
  }

  async existingIds(ids: string[]): Promise<Set<string>> {
    return resolveExistingIds(this.pageModel, ids);
  }

  async previewEntityCollection(
    input: EntityCollectionPreviewInput,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    if (input.contextDomainId) {
      await this.domainsService.getActiveById(input.contextDomainId);
    }
    signal?.throwIfAborted();
    const context = {
      domainId: input.contextDomainId || undefined,
      now: new Date(),
      ordering: undefined as RandomOrdering | undefined,
    };
    if (input.itemOrder === EntityCollectionItemOrder.Random) {
      const owner =
        input.owner?.kind === 'persistedPage'
          ? { kind: 'page' as const, pageId: input.owner.pageId }
          : input.owner;
      context.ordering = createRandomOrdering(
        { ...context, owner, blockPath: input.blockPath },
        input.entityType,
      );
    }
    const metadata = context.ordering
      ? { orderBucket: orderBucket(context.now) }
      : {};
    const limit = input.limit ?? 12;
    switch (input.entityType) {
      case EntityCollectionEntityType.People:
        return {
          ...metadata,
          items: await this.peopleService.findDynamicPreviewItems(
            input.filters,
            limit,
            context.ordering,
            signal,
          ),
        };
      case EntityCollectionEntityType.Partners:
        return {
          ...metadata,
          items: await this.partnersService.findDynamicPreviewItems(
            input.filters,
            limit,
            context.ordering,
            signal,
          ),
        };
      case EntityCollectionEntityType.Events:
        return {
          ...metadata,
          items: await this.eventsService.findDynamicPreviewItems(
            input.filters,
            limit,
            context,
            signal,
          ),
        };
      default:
        throw new BadRequestException('Unsupported entity collection type');
    }
  }

  async getPublicEventCollectionSnapshot(
    pageId: string,
    signal?: AbortSignal,
  ): Promise<EventCollectionSnapshot> {
    const validId = validateObjectId(pageId);
    if (!validId) throw new NotFoundException('Page not found');
    const snapshotNow = new Date();
    await this.eventsService.reconcileExpiredNonRecurring(snapshotNow);
    const page = await this.pageModel
      .findOne({ _id: validId, status: PageStatus.Published })
      .lean()
      .exec();
    if (!page) throw new NotFoundException('Page not found');

    let storedCollections: ReturnType<typeof collectStoredEventCollections>;
    try {
      storedCollections = collectStoredEventCollections(
        validId,
        (Array.isArray(page.blocks) ? page.blocks : []) as PageRootBlock[],
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.warn(
          JSON.stringify({
            event: 'ambiguous_event_collection_identity',
            pageId: validId,
          }),
        );
      }
      throw error;
    }
    const selectedIds = new Set<string>();
    const candidateIds = new Set<string>();
    const collections: EventCollectionSnapshot['collections'] = [];

    for (const entry of storedCollections) {
      signal?.throwIfAborted();
      const block = entry.block;
      let items: string[];
      let candidates: string[];
      if (block.source === 'dynamic') {
        const ordering =
          block.itemOrder === EntityCollectionItemOrder.Random
            ? createRandomOrdering(
                {
                  owner: entry.identity.owner,
                  blockPath: entry.identity.blockPath,
                  domainId: page.domainId?.toString(),
                  now: snapshotNow,
                },
                EntityCollectionEntityType.Events,
              )
            : undefined;
        const resolved =
          await this.eventsService.findDynamicSnapshotCandidateIds(
            block.filters as EventEntityCollectionFilters,
            block.limit ?? 12,
            {
              now: snapshotNow,
              domainId: page.domainId?.toString(),
              ordering,
            },
            signal,
            entry.identity,
          );
        items = resolved.selectedIds;
        candidates = resolved.candidateIds;
      } else {
        items = Array.isArray(block.items)
          ? block.items.filter((id): id is string => typeof id === 'string')
          : [];
        if (block.itemOrder === EntityCollectionItemOrder.Random) {
          const ordering = createRandomOrdering(
            {
              owner: entry.identity.owner,
              blockPath: entry.identity.blockPath,
              domainId: page.domainId?.toString(),
              now: snapshotNow,
            },
            EntityCollectionEntityType.Events,
          );
          items = permuteItems(items, ordering.seed, (id) => id);
        }
        candidates = items;
      }
      items.forEach((id) => selectedIds.add(id));
      for (const id of candidates) {
        candidateIds.add(id);
        if (candidateIds.size > EVENT_SNAPSHOT_PAGE_CANDIDATE_LIMIT) {
          this.logger.warn(
            JSON.stringify({
              event: 'event_snapshot_page_candidate_overflow',
              pageId: validId,
              limit: EVENT_SNAPSHOT_PAGE_CANDIDATE_LIMIT,
              identity: entry.identity,
            }),
          );
          throw new ServiceUnavailableException(
            'Page Event snapshot candidate limit exceeded',
          );
        }
      }
      collections.push({ identity: entry.identity, items });
    }

    const [events, transitionBoundaries] = await Promise.all([
      this.eventsService.findManyPublicByIdsAt(
        [...selectedIds],
        snapshotNow,
        signal,
      ),
      this.eventsService.findTransitionBoundariesByIdsAt(
        [...candidateIds],
        snapshotNow,
      ),
    ]);
    const transitions = transitionBoundaries
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite);

    return {
      evaluatedAt: snapshotNow.toISOString(),
      ...(transitions.length
        ? { nextTransitionAt: new Date(Math.min(...transitions)).toISOString() }
        : {}),
      collections,
      events,
    };
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

  private async toPublicPage(
    page: PublicPageSource,
    signal?: AbortSignal,
  ): Promise<PageDocument> {
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const publicBlocks = await toPublicBlocks(
      blocks,
      {
        findPublishedPeopleSummariesByIds: (ids) =>
          this.peopleService.findPublishedSummariesByIds(ids),
        findDynamicPeopleSummaries: (filters, limit, ordering) =>
          this.peopleService.findDynamicSummaries(filters, limit, ordering),
        findDynamicPartnerSummaries: (filters, limit, ordering) =>
          this.partnersService.findDynamicSummaries(filters, limit, ordering),
        findDynamicEventSummaries: (filters, limit, context, signal) =>
          this.eventsService.findDynamicSummaries(
            filters,
            limit,
            context,
            signal,
          ),
      },
      {
        owner: { kind: 'page', pageId: String(page._id) },
        domainId: this.toIdString(page.domainId),
        now: new Date(),
        signal,
      },
      { dynamicRandom: 'enabled', eventCollections: 'descriptor' },
    );

    return this.normalizePageTitleVisibility({
      ...(page as unknown as PageDocument),
      blocks: publicBlocks as mongoose.Types.Array<PageBlock>,
    } as unknown as Record<string, unknown>);
  }

  private toIdString(value: unknown): string | undefined {
    if (!value) return undefined;
    return typeof value === 'string'
      ? value
      : (value as { toString(): string }).toString();
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
