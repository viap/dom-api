import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
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
import { MediaService } from '@/media/media.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnerQueryParams } from './types/query-params.interface';
import { Partner, PartnerDocument } from './schemas/partner.schema';

type MongoDuplicateSlugError = {
  code: number;
  keyPattern?: {
    slug?: number;
  };
};

@Injectable()
export class PartnersService {
  constructor(
    @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
    private mediaService: MediaService,
  ) {}

  async create(createPartnerDto: CreatePartnerDto): Promise<PartnerDocument> {
    await this.validateLogo(createPartnerDto.logoId);
    await this.ensureUniqueSlug(createPartnerDto.slug);

    const partner = new this.partnerModel(createPartnerDto);
    try {
      return await partner.save();
    } catch (error) {
      if (this.isMongoDuplicateSlugError(error)) {
        throw new ConflictException('Partner with this slug already exists');
      }
      throw error;
    }
  }

  async findAll(
    queryParams: PartnerQueryParams = {},
  ): Promise<PartnerDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
    const query: Record<string, unknown> = { isPublished: true };

    if (safeParams.title && typeof safeParams.title === 'string') {
      query.title = { $regex: new RegExp(safeParams.title, 'i') };
    }

    if (safeParams.type && typeof safeParams.type === 'string') {
      query.type = safeParams.type;
    }

    return this.partnerModel
      .find(query)
      .select({ contacts: 0 })
      .sort({ title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<PartnerDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid partner ID format');
    }

    const partner = await this.partnerModel
      .findOne({ _id: validId, isPublished: true })
      .select({ contacts: 0 })
      .lean()
      .exec();
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return partner as PartnerDocument;
  }

  async findOneBySlug(slug: string): Promise<PartnerDocument> {
    const partner = await this.partnerModel
      .findOne({ slug, isPublished: true })
      .select({ contacts: 0 })
      .lean()
      .exec();
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return partner as PartnerDocument;
  }

  async findManyByIds(
    ids: string[],
  ): Promise<BulkResolveResponse<PartnerDocument>> {
    const preparedIds = prepareBulkIds(ids);
    if (!preparedIds.validIds.length) {
      return {
        items: [],
      };
    }

    const partners = await this.partnerModel
      .find({ _id: { $in: preparedIds.validIds }, isPublished: true })
      .select({ contacts: 0 })
      .lean()
      .exec();

    return toBulkResolveResponse({
      preparedIds,
      items: partners as PartnerDocument[],
      getId: (partner) => partner._id.toString(),
    });
  }

  async findAllAdmin(
    queryParams: PartnerQueryParams = {},
  ): Promise<PartnerDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
    const query: Record<string, unknown> = {};

    if (safeParams.title && typeof safeParams.title === 'string') {
      query.title = { $regex: new RegExp(safeParams.title, 'i') };
    }

    if (safeParams.type && typeof safeParams.type === 'string') {
      query.type = safeParams.type;
    }

    return this.partnerModel
      .find(query)
      .sort({ title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findOneAdmin(id: string): Promise<PartnerDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid partner ID format');
    }

    const partner = await this.partnerModel.findById(validId).lean().exec();
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return partner as PartnerDocument;
  }

  async update(
    id: string,
    updatePartnerDto: UpdatePartnerDto,
  ): Promise<PartnerDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid partner ID format');
    }

    await this.validateLogo(updatePartnerDto.logoId);

    if (updatePartnerDto.slug !== undefined) {
      const existingPartner = await this.partnerModel
        .findById(validId)
        .lean()
        .exec();
      if (!existingPartner) {
        throw new NotFoundException('Partner not found');
      }

      if (updatePartnerDto.slug !== existingPartner.slug) {
        await this.ensureUniqueSlug(updatePartnerDto.slug, validId);
      }
    }

    try {
      const partner = await this.partnerModel
        .findByIdAndUpdate(validId, updatePartnerDto, { new: true })
        .lean()
        .exec();
      if (!partner) {
        throw new NotFoundException('Partner not found');
      }

      return partner as PartnerDocument;
    } catch (error) {
      if (this.isMongoDuplicateSlugError(error)) {
        throw new ConflictException('Partner with this slug already exists');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid partner ID format');
    }

    const result = await this.partnerModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Partner not found');
    }

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.partnerModel.countDocuments({ _id: validId });
    return count > 0;
  }

  async existingIds(ids: string[]): Promise<Set<string>> {
    return resolveExistingIds(this.partnerModel, ids);
  }

  private async validateLogo(logoId?: string): Promise<void> {
    if (!logoId) {
      return;
    }

    const mediaExists = await this.mediaService.existsPublished(logoId);
    if (!mediaExists) {
      throw new BadRequestException('Referenced published media not found');
    }
  }

  private async ensureUniqueSlug(
    slug?: string,
    excludeId?: string,
  ): Promise<void> {
    if (!slug) {
      return;
    }

    const query: FilterQuery<PartnerDocument> = { slug };
    if (excludeId) {
      query._id = { $ne: new Types.ObjectId(excludeId) };
    }

    const existing = await this.partnerModel.findOne(query).lean().exec();
    if (existing) {
      throw new ConflictException('Partner with this slug already exists');
    }
  }

  private isMongoDuplicateSlugError(
    error: unknown,
  ): error is MongoDuplicateSlugError {
    if (!error || typeof error !== 'object') {
      return false;
    }

    if (!('code' in error) || !('keyPattern' in error)) {
      return false;
    }

    const mongoError = error as MongoDuplicateSlugError;
    return mongoError.code === 11000 && !!mongoError.keyPattern?.slug;
  }
}
