import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationQueryParams } from './types/query-params.interface';
import { Location, LocationDocument } from './schemas/location.schema';

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
  ) {}

  async create(
    createLocationDto: CreateLocationDto,
  ): Promise<LocationDocument> {
    const location = new this.locationModel(createLocationDto);
    return location.save();
  }

  async findAll(
    queryParams: LocationQueryParams = {},
  ): Promise<LocationDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = this.parseLimit(safeParams.limit);
    const offset = this.parseOffset(safeParams.offset);

    const query: Record<string, unknown> = {};
    if (safeParams.title && typeof safeParams.title === 'string') {
      query.title = { $regex: new RegExp(safeParams.title, 'i') };
    }
    if (safeParams.city && typeof safeParams.city === 'string') {
      query.city = { $regex: new RegExp(safeParams.city, 'i') };
    }

    return this.locationModel
      .find(query)
      .sort({ title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<LocationDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid location ID format');
    }

    const location = await this.locationModel.findById(validId).lean().exec();
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location as LocationDocument;
  }

  async update(
    id: string,
    updateLocationDto: UpdateLocationDto,
  ): Promise<LocationDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid location ID format');
    }

    const location = await this.locationModel
      .findByIdAndUpdate(validId, updateLocationDto, { new: true })
      .lean()
      .exec();
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location as LocationDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid location ID format');
    }

    const result = await this.locationModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Location not found');
    }

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.locationModel.countDocuments({ _id: validId });
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
