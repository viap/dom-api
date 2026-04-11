import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { DomainsService } from '@/domains/domains.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PageStatus } from './enums/page-status.enum';
import { PageQueryParams } from './types/query-params.interface';
import { Page, PageDocument } from './schemas/page.schema';

@Injectable()
export class PagesService {
  constructor(
    @InjectModel(Page.name) private pageModel: Model<PageDocument>,
    private domainsService: DomainsService,
  ) {}

  async create(createPageDto: CreatePageDto): Promise<PageDocument> {
    if (createPageDto.domainId) {
      await this.domainsService.getActiveById(createPageDto.domainId);
    }
    await this.ensureUniqueSlug(createPageDto.domainId, createPageDto.slug);

    const page = new this.pageModel(createPageDto);
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

    return this.pageModel
      .find({
        domainId,
        status: PageStatus.Published,
      })
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findAllByDomainSlug(
    domainSlug: string,
    queryParams: { limit?: string; offset?: string } = {},
  ): Promise<PageDocument[]> {
    const domain = await this.domainsService.getActiveBySlug(domainSlug);
    const safeParams = safeFindParams(queryParams);
    const limit = this.parseLimit(safeParams.limit);
    const offset = this.parseOffset(safeParams.offset);

    return this.pageModel
      .find({
        domainId: domain._id,
        status: PageStatus.Published,
      })
      .sort({ updatedAt: -1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
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

    return page as PageDocument;
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

    return page as PageDocument;
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

    return page as PageDocument;
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

    const updateData = {
      ...updatePageDto,
    } as Record<string, unknown>;
    if (hasDomainIdField && !domainId) {
      updateData.$unset = { domainId: 1 };
      delete updateData.domainId;
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
}
