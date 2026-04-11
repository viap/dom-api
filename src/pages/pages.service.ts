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
import { PageQueryParams } from './types/query-params.interface';
import { Page, PageDocument } from './schemas/page.schema';
import { PageBlock } from './types/page-block.interface';
import { sanitizeRichTextHtml } from './utils/html-sanitizer';

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
    await this.ensureUniqueSlug(createPageDto.domainId, createPageDto.slug);
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

    const limit = this.parseLimit(safeParams.limit);
    const offset = this.parseOffset(safeParams.offset);

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
    const limit = this.parseLimit(safeParams.limit);
    const offset = this.parseOffset(safeParams.offset);

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

  async findAllGlobal(queryParams: {
    limit?: string;
    offset?: string;
  } = {}): Promise<PageDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = this.parseLimit(safeParams.limit);
    const offset = this.parseOffset(safeParams.offset);

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

  async update(id: string, updatePageDto: UpdatePageDto): Promise<PageDocument> {
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

    if (domainId) {
      await this.domainsService.getActiveById(domainId);
    }
    await this.ensureUniqueSlug(domainId, slug, validId);
    const normalizedBlocks =
      updatePageDto.blocks !== undefined
        ? await this.prepareBlocksForWrite(updatePageDto.blocks)
        : undefined;

    const updateData = {
      ...updatePageDto,
    } as Record<string, unknown>;
    if (hasDomainIdField && !domainId) {
      updateData.$unset = { domainId: 1 };
      delete updateData.domainId;
    }
    if (normalizedBlocks !== undefined) {
      updateData.blocks = normalizedBlocks;
    }

    const page = await this.pageModel
      .findByIdAndUpdate(validId, updateData, { new: true })
      .lean()
      .exec();

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
    domainId: string | undefined,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = domainId
      ? { domainId, slug }
      : { slug, domainId: { $exists: false } };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.pageModel.findOne(query);
    if (existing) {
      throw new ConflictException(
        domainId
          ? 'Page with this slug already exists in the domain'
          : 'Global page with this slug already exists',
      );
    }
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

  private async prepareBlocksForWrite(blocks: PageBlock[]): Promise<PageBlock[]> {
    await this.validateBlocks(blocks);

    return blocks.map((block) => {
      const normalized = {
        ...block,
      } as Record<string, unknown>;

      if (block.type === PageBlockType.RichText) {
        normalized.description =
          typeof block.description === 'string'
            ? sanitizeRichTextHtml(block.description)
            : block.description;
        if (block.relatedPeople && !block.relatedPeople.display) {
          normalized.relatedPeople = {
            ...block.relatedPeople,
            display: 'inline',
          };
        }
      }

      return normalized as unknown as PageBlock;
    });
  }

  private async validateBlocks(blocks: PageBlock[]): Promise<void> {
    const seenIds = new Set<string>();

    for (const block of blocks) {
      if (seenIds.has(block.id)) {
        throw new BadRequestException(
          `Duplicate block id found in page payload: ${block.id}`,
        );
      }
      seenIds.add(block.id);

      switch (block.type) {
        case PageBlockType.RichText:
          await this.validateRichTextBlock(block);
          break;
        case PageBlockType.EntityCollection:
          await this.validateEntityCollectionBlock(block);
          break;
        case PageBlockType.Hero:
          await this.validateHeroBlock(block);
          break;
        case PageBlockType.Cta:
          await this.validateButtons(block.buttons);
          break;
        case PageBlockType.Gallery:
          await this.validateGalleryBlock(block);
          break;
        case PageBlockType.ApplicationForm:
          this.validateApplicationFormType(block.applicationType);
          break;
        default:
          throw new BadRequestException('Unsupported page block type');
      }
    }
  }

  private async validateRichTextBlock(block: PageBlock): Promise<void> {
    if (block.type !== PageBlockType.RichText) {
      return;
    }

    if (block.media) {
      await this.ensureMediaExists(block.media.mediaId);
    }

    await this.validateButtons(block.buttons);

    if (block.relatedPeople) {
      if (!block.relatedPeople.title) {
        throw new BadRequestException('relatedPeople.title is required');
      }
      if (!block.relatedPeople.peopleIds.length) {
        throw new BadRequestException(
          'relatedPeople.peopleIds must contain at least one person',
        );
      }
      for (const personId of block.relatedPeople.peopleIds) {
        await this.ensurePersonExists(personId);
      }
    }
  }

  private async validateEntityCollectionBlock(block: PageBlock): Promise<void> {
    if (block.type !== PageBlockType.EntityCollection) {
      return;
    }

    for (const itemId of block.items) {
      switch (block.entityType) {
        case EntityCollectionEntityType.People:
          await this.ensurePersonExists(itemId);
          break;
        case EntityCollectionEntityType.Partners:
          await this.ensurePartnerExists(itemId);
          break;
        case EntityCollectionEntityType.Events:
          await this.ensureEventExists(itemId);
          break;
        default:
          throw new BadRequestException(
            `Unsupported entity collection type: ${block.entityType}`,
          );
      }
    }
  }

  private async validateHeroBlock(block: PageBlock): Promise<void> {
    if (block.type !== PageBlockType.Hero) {
      return;
    }

    if (block.backgroundMedia) {
      await this.ensureMediaExists(block.backgroundMedia.mediaId);
    }

    await this.validateButtons(block.buttons);
    for (const item of block.items || []) {
      if (item.button) {
        await this.validateButtons([item.button]);
      }
    }
  }

  private async validateGalleryBlock(block: PageBlock): Promise<void> {
    if (block.type !== PageBlockType.Gallery) {
      return;
    }

    for (const item of block.items) {
      await this.ensureMediaExists(item.mediaId);
    }
  }

  private validateApplicationFormType(value: string): void {
    if (!Object.values(ApplicationFormType).includes(value as ApplicationFormType)) {
      throw new BadRequestException(
        `Unsupported application form type: ${value}`,
      );
    }
  }

  private async validateButtons(buttons?: {
    type: BlockButtonType;
    targetId?: string;
  }[]): Promise<void> {
    for (const button of buttons || []) {
      switch (button.type) {
        case BlockButtonType.External:
          break;
        case BlockButtonType.Page:
          if (!button.targetId || !(await this.exists(button.targetId))) {
            throw new BadRequestException('Referenced page button target not found');
          }
          break;
        case BlockButtonType.Domain:
          if (!button.targetId) {
            throw new BadRequestException('Domain button target is required');
          }
          await this.domainsService.getActiveById(button.targetId);
          break;
        case BlockButtonType.Application:
          if (!button.targetId) {
            throw new BadRequestException('Application button target is required');
          }
          this.validateApplicationFormType(button.targetId);
          break;
        default:
          throw new BadRequestException(`Unsupported button type: ${button.type}`);
      }
    }
  }

  private async ensurePersonExists(id: string): Promise<void> {
    const exists = await this.peopleService.exists(id);
    if (!exists) {
      throw new BadRequestException(`Referenced person not found: ${id}`);
    }
  }

  private async ensurePartnerExists(id: string): Promise<void> {
    const exists = await this.partnersService.exists(id);
    if (!exists) {
      throw new BadRequestException(`Referenced partner not found: ${id}`);
    }
  }

  private async ensureEventExists(id: string): Promise<void> {
    const exists = await this.eventsService.exists(id);
    if (!exists) {
      throw new BadRequestException(`Referenced event not found: ${id}`);
    }
  }

  private async ensureMediaExists(id: string): Promise<void> {
    const exists = await this.mediaService.exists(id);
    if (!exists) {
      throw new BadRequestException(`Referenced media not found: ${id}`);
    }
  }

  private async toPublicPage(page: Record<string, unknown>): Promise<PageDocument> {
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const publicBlocks = [];

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
      blocks: publicBlocks as unknown as mongoose.Types.Array<PageBlock>,
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

    const people: Array<{ _id: string; fullName: string }> = [];
    const visiblePeopleIds: string[] = [];

    for (const personId of peopleIds) {
      try {
        const person = await this.peopleService.findOne(personId);
        people.push({
          _id: person._id.toString(),
          fullName: person.fullName,
        });
        visiblePeopleIds.push(person._id.toString());
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
    }

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
}
