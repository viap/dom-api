import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { validateObjectId } from '@/common/utils/mongo-sanitizer';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { Domain, DomainDocument } from './schemas/domain.schema';

@Injectable()
export class DomainsService {
  constructor(
    @InjectModel(Domain.name) private domainModel: Model<DomainDocument>,
  ) {}

  async create(createDomainDto: CreateDomainDto): Promise<DomainDocument> {
    await this.ensureUniqueness(createDomainDto.code, createDomainDto.slug);

    const domain = new this.domainModel(createDomainDto);
    return domain.save();
  }

  async findAll(): Promise<DomainDocument[]> {
    return this.domainModel.find().sort({ order: 1, title: 1 }).lean().exec();
  }

  async findOne(id: string): Promise<DomainDocument> {
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

  async update(
    id: string,
    updateDomainDto: UpdateDomainDto,
  ): Promise<DomainDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid domain ID format');
    }

    if (updateDomainDto.code) {
      const existingByCode = await this.domainModel.findOne({
        code: updateDomainDto.code,
        _id: { $ne: validId },
      });
      if (existingByCode) {
        throw new ConflictException('Domain with this code already exists');
      }
    }

    if (updateDomainDto.slug) {
      const existingBySlug = await this.domainModel.findOne({
        slug: updateDomainDto.slug,
        _id: { $ne: validId },
      });
      if (existingBySlug) {
        throw new ConflictException('Domain with this slug already exists');
      }
    }

    const domain = await this.domainModel
      .findByIdAndUpdate(validId, updateDomainDto, { new: true })
      .lean()
      .exec();

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    return domain as DomainDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid domain ID format');
    }

    const result = await this.domainModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Domain not found');
    }

    return true;
  }

  async getActiveById(id: string): Promise<DomainDocument> {
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

  async getActiveBySlug(slug: string): Promise<DomainDocument> {
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

  private async ensureUniqueness(code: string, slug: string): Promise<void> {
    const [existingByCode, existingBySlug] = await Promise.all([
      this.domainModel.findOne({ code }),
      this.domainModel.findOne({ slug }),
    ]);

    if (existingByCode) {
      throw new ConflictException('Domain with this code already exists');
    }

    if (existingBySlug) {
      throw new ConflictException('Domain with this slug already exists');
    }
  }
}
