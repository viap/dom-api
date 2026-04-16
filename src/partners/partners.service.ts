import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
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

@Injectable()
export class PartnersService {
  constructor(
    @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
    private mediaService: MediaService,
  ) {}

  async create(createPartnerDto: CreatePartnerDto): Promise<PartnerDocument> {
    await this.validateLogo(createPartnerDto.logoId);

    const partner = new this.partnerModel(createPartnerDto);
    return partner.save();
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

    const partner = await this.partnerModel
      .findByIdAndUpdate(validId, updatePartnerDto, { new: true })
      .lean()
      .exec();
    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return partner as PartnerDocument;
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
}
