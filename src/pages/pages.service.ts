import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { ApplicationFormType } from '@/applications/enums/application-form-type.enum';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
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
import { BlockButtonType } from './enums/block-button-type.enum';
import { EntityCollectionEntityType } from './enums/entity-collection-entity-type.enum';
import { PageBlockType } from './enums/page-block-type.enum';
import { PageStatus } from './enums/page-status.enum';
import { RelatedPeopleDisplay } from './enums/related-people-display.enum';
import { PageQueryParams } from './types/query-params.interface';
import { Page, PageDocument } from './schemas/page.schema';
import {
  CtaBlock,
  EntityCollectionBlock,
  GalleryBlock,
  HeroBlock,
  PageBlock,
  RichTextBlock,
} from './types/page-block.interface';
import { sanitizeRichTextHtml } from './utils/html-sanitizer';

type PageReference = {
  _id: mongoose.Types.ObjectId | string;
  slug: string;
  domainId?: mongoose.Types.ObjectId | string;
  status?: PageStatus;
};

type PublicPageSource = {
  blocks?: Array<PageBlock | Record<string, unknown>>;
} & Record<string, unknown>;

type ValidationRefs = {
  peopleIds: Set<string>;
  partnerIds: Set<string>;
  eventIds: Set<string>;
  mediaIds: Set<string>;
  pageIds: Set<string>;
  domainIds: Set<string>;
};

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

    this.ensurePublishedHomepage(status, isHomepage);
    await this.ensureUniqueSlug(createPageDto.slug);
    if (isHomepage) {
      await this.ensureUniqueHomepage(createPageDto.domainId);
    }

    const normalizedBlocks = await this.prepareBlocksForWrite(
      createPageDto.blocks || [],
    );

    const page = new this.pageModel({
      ...createPageDto,
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

    return this.pageModel
      .find({
        domainId: { $exists: false },
      })
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
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

    return page as PageDocument;
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
        ? await this.prepareBlocksForWrite(updatePageDto.blocks)
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

    return page as PageDocument;
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

  private async prepareBlocksForWrite(
    blocks: PageBlock[],
  ): Promise<PageBlock[]> {
    await this.validateBlocks(blocks);

    return blocks.map((block) => {
      if (block.type !== PageBlockType.RichText) {
        return block;
      }

      return {
        ...block,
        description:
          typeof block.description === 'string'
            ? sanitizeRichTextHtml(block.description)
            : block.description,
        relatedPeople: block.relatedPeople
          ? {
              ...block.relatedPeople,
              display:
                block.relatedPeople.display || RelatedPeopleDisplay.Inline,
            }
          : undefined,
      };
    });
  }

  private async validateBlocks(blocks: PageBlock[]): Promise<void> {
    const seenIds = new Set<string>();
    const refs = this.createValidationRefs();

    for (const block of blocks) {
      if (seenIds.has(block.id)) {
        throw new BadRequestException(
          `Duplicate block id found in page payload: ${block.id}`,
        );
      }
      seenIds.add(block.id);

      switch (block.type) {
        case PageBlockType.RichText:
          this.validateRichTextBlock(block, refs);
          break;
        case PageBlockType.EntityCollection:
          this.validateEntityCollectionBlock(block, refs);
          break;
        case PageBlockType.Hero:
          this.validateHeroBlock(block, refs);
          break;
        case PageBlockType.Cta:
          this.validateCtaBlock(block, refs);
          break;
        case PageBlockType.Gallery:
          this.validateGalleryBlock(block, refs);
          break;
        case PageBlockType.ApplicationForm:
          this.validateApplicationFormType(block.applicationType);
          break;
        default:
          throw new BadRequestException('Unsupported page block type');
      }
    }

    await this.validateCollectedRefs(refs);
  }

  private validateRichTextBlock(
    block: RichTextBlock,
    refs: ValidationRefs,
  ): void {
    if (block.media) {
      refs.mediaIds.add(block.media.mediaId);
    }

    this.collectButtonRefs(block.buttons, refs);

    if (block.relatedPeople) {
      if (!block.relatedPeople.title) {
        throw new BadRequestException('relatedPeople.title is required');
      }
      if (!block.relatedPeople.peopleIds.length) {
        throw new BadRequestException(
          'relatedPeople.peopleIds must contain at least one person',
        );
      }
      this.collectIds(refs.peopleIds, block.relatedPeople.peopleIds);
    }
  }

  private validateEntityCollectionBlock(
    block: EntityCollectionBlock,
    refs: ValidationRefs,
  ): void {
    this.ensureBlockHasItems(
      block.items,
      'entityCollection.items must contain at least one item',
    );

    switch (block.entityType) {
      case EntityCollectionEntityType.People:
        this.collectIds(refs.peopleIds, block.items);
        break;
      case EntityCollectionEntityType.Partners:
        this.collectIds(refs.partnerIds, block.items);
        break;
      case EntityCollectionEntityType.Events:
        this.collectIds(refs.eventIds, block.items);
        break;
      default:
        throw new BadRequestException(
          `Unsupported entity collection type: ${block.entityType}`,
        );
    }
  }

  private validateHeroBlock(block: HeroBlock, refs: ValidationRefs): void {
    if (block.backgroundMedia) {
      refs.mediaIds.add(block.backgroundMedia.mediaId);
    }

    for (const item of block.items || []) {
      if (item.button) {
        this.collectButtonRefs([item.button], refs);
      }
    }
  }

  private validateCtaBlock(block: CtaBlock, refs: ValidationRefs): void {
    this.ensureBlockHasItems(
      block.buttons,
      'cta.buttons must contain at least one button',
    );
    this.collectButtonRefs(block.buttons, refs);
  }

  private validateGalleryBlock(
    block: GalleryBlock,
    refs: ValidationRefs,
  ): void {
    this.ensureBlockHasItems(
      block.items,
      'gallery.items must contain at least one item',
    );

    for (const item of block.items) {
      refs.mediaIds.add(item.mediaId);
    }
  }

  private validateApplicationFormType(value: string): void {
    if (
      !Object.values(ApplicationFormType).includes(value as ApplicationFormType)
    ) {
      throw new BadRequestException(
        `Unsupported application form type: ${value}`,
      );
    }
  }

  private collectButtonRefs(
    buttons: Array<{
      type: BlockButtonType;
      targetId?: string;
      url?: string;
    }> = [],
    refs: ValidationRefs,
  ): void {
    for (const button of buttons || []) {
      switch (button.type) {
        case BlockButtonType.External:
          if (!button.url) {
            throw new BadRequestException('External button url is required');
          }
          if (button.targetId) {
            throw new BadRequestException(
              'External buttons must not include targetId',
            );
          }
          break;
        case BlockButtonType.Page:
          if (!button.targetId) {
            throw new BadRequestException('Page button target is required');
          }
          if (button.url) {
            throw new BadRequestException('Page buttons must not include url');
          }
          refs.pageIds.add(button.targetId);
          break;
        case BlockButtonType.Domain:
          if (!button.targetId) {
            throw new BadRequestException('Domain button target is required');
          }
          if (button.url) {
            throw new BadRequestException(
              'Domain buttons must not include url',
            );
          }
          refs.domainIds.add(button.targetId);
          break;
        case BlockButtonType.Application:
          if (!button.targetId) {
            throw new BadRequestException(
              'Application button target is required',
            );
          }
          if (button.url) {
            throw new BadRequestException(
              'Application buttons must not include url',
            );
          }
          this.validateApplicationFormType(button.targetId);
          break;
        default:
          throw new BadRequestException(
            `Unsupported button type: ${button.type}`,
          );
      }
    }
  }

  private ensureBlockHasItems(
    items: unknown[] | undefined,
    message: string,
  ): asserts items is unknown[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException(message);
    }
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
    const publicBlocks: Array<PageBlock | Record<string, unknown>> = [];

    for (const block of blocks) {
      if (!block || typeof block !== 'object') {
        continue;
      }

      const typedBlock = block as Record<string, unknown>;
      if (typedBlock.isVisible === false) {
        continue;
      }

      if (typedBlock.type === PageBlockType.RichText) {
        const processedBlock = await this.toPublicRichTextBlock(typedBlock);
        if (processedBlock) {
          publicBlocks.push(processedBlock);
        }
        continue;
      }

      publicBlocks.push(typedBlock);
    }

    return {
      ...(page as unknown as PageDocument),
      blocks: publicBlocks as mongoose.Types.Array<PageBlock>,
    } as unknown as PageDocument;
  }

  private async toPublicRichTextBlock(
    block: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const relatedPeople =
      block.relatedPeople && typeof block.relatedPeople === 'object'
        ? (block.relatedPeople as Record<string, unknown>)
        : null;

    if (!relatedPeople) {
      return block;
    }

    const peopleIds = Array.isArray(relatedPeople.peopleIds)
      ? relatedPeople.peopleIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    const summaries = await this.peopleService.findPublishedSummariesByIds(
      peopleIds,
    );
    const peopleById = new Map(
      summaries.map((person) => [person._id.toString(), person]),
    );
    const people = peopleIds
      .map((personId) => peopleById.get(personId))
      .filter(
        (
          person,
        ): person is {
          _id: string;
          fullName: string;
        } => Boolean(person),
      );
    const visiblePeopleIds = people.map((person) => person._id);

    if (!people.length) {
      const { relatedPeople: _relatedPeople, ...rest } = block;
      return rest;
    }

    return {
      ...block,
      relatedPeople: {
        ...relatedPeople,
        peopleIds: visiblePeopleIds,
        people,
      },
    };
  }

  private createValidationRefs(): ValidationRefs {
    return {
      peopleIds: new Set<string>(),
      partnerIds: new Set<string>(),
      eventIds: new Set<string>(),
      mediaIds: new Set<string>(),
      pageIds: new Set<string>(),
      domainIds: new Set<string>(),
    };
  }

  private collectIds(target: Set<string>, ids: string[]): void {
    for (const id of ids) {
      target.add(id);
    }
  }

  private async validateCollectedRefs(refs: ValidationRefs): Promise<void> {
    await Promise.all([
      this.ensureExistingIds(
        refs.peopleIds,
        (ids) => this.peopleService.existingIds(ids),
        'Referenced person not found: ',
      ),
      this.ensureExistingIds(
        refs.partnerIds,
        (ids) => this.partnersService.existingIds(ids),
        'Referenced partner not found: ',
      ),
      this.ensureExistingIds(
        refs.eventIds,
        (ids) => this.eventsService.existingIds(ids),
        'Referenced event not found: ',
      ),
      this.ensureExistingIds(
        refs.mediaIds,
        (ids) => this.mediaService.existingPublishedIds(ids),
        'Referenced published media not found: ',
      ),
      this.ensureExistingIds(
        refs.pageIds,
        (ids) => this.existingIds(ids),
        'Referenced page button target not found: ',
      ),
      Promise.all(
        [...refs.domainIds].map((id) => this.domainsService.getActiveById(id)),
      ),
    ]);
  }

  private async ensureExistingIds(
    ids: Set<string>,
    resolver: (ids: string[]) => Promise<Set<string>>,
    messagePrefix: string,
  ): Promise<void> {
    if (!ids.size) {
      return;
    }

    const values = [...ids];
    const existingIds = await resolver(values);
    const missingId = values.find((id) => !existingIds.has(id));
    if (missingId) {
      throw new BadRequestException(`${messagePrefix}${missingId}`);
    }
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
