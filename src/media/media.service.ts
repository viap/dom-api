import {
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
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaQueryParams } from './types/query-params.interface';
import { Media, MediaDocument } from './schemas/media.schema';

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(Media.name) private mediaModel: Model<MediaDocument>,
  ) {}

  async create(createMediaDto: CreateMediaDto): Promise<MediaDocument> {
    const existingMedia = await this.mediaModel.findOne({
      storageKey: createMediaDto.storageKey,
    });
    if (existingMedia) {
      throw new ConflictException('Media with this storage key already exists');
    }

    const media = new this.mediaModel(createMediaDto);
    return media.save();
  }

  async findAll(queryParams: MediaQueryParams = {}): Promise<MediaDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = this.parseLimit(safeParams.limit);
    const offset = this.parseOffset(safeParams.offset);

    return this.mediaModel
      .find({ isPublished: true })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<MediaDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid media ID format');
    }

    const media = await this.mediaModel
      .findOne({ _id: validId, isPublished: true })
      .lean()
      .exec();
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media as MediaDocument;
  }

  async update(
    id: string,
    updateMediaDto: UpdateMediaDto,
  ): Promise<MediaDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid media ID format');
    }

    if (updateMediaDto.storageKey) {
      const existingMedia = await this.mediaModel.findOne({
        storageKey: updateMediaDto.storageKey,
        _id: { $ne: validId },
      });
      if (existingMedia) {
        throw new ConflictException(
          'Media with this storage key already exists',
        );
      }
    }

    const media = await this.mediaModel
      .findByIdAndUpdate(validId, updateMediaDto, { new: true })
      .lean()
      .exec();
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return media as MediaDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid media ID format');
    }

    const result = await this.mediaModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Media not found');
    }

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.mediaModel.countDocuments({ _id: validId });
    return count > 0;
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
