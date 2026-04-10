import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { MediaService } from '@/media/media.service';
import { UsersService } from '@/users/users.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonQueryParams } from './types/query-params.interface';
import { Person, PersonDocument } from './schemas/person.schema';

@Injectable()
export class PeopleService {
  constructor(
    @InjectModel(Person.name) private personModel: Model<PersonDocument>,
    private usersService: UsersService,
    private mediaService: MediaService,
  ) {}

  async create(createPersonDto: CreatePersonDto): Promise<PersonDocument> {
    await this.validateRefs(createPersonDto.userId, createPersonDto.photoId);

    const person = new this.personModel(createPersonDto);
    return person.save();
  }

  async findAll(
    queryParams: PersonQueryParams = {},
  ): Promise<PersonDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = this.parseLimit(safeParams.limit);
    const offset = this.parseOffset(safeParams.offset);
    const query: Record<string, unknown> = { isPublished: true };

    if (safeParams.fullName && typeof safeParams.fullName === 'string') {
      query.fullName = { $regex: new RegExp(safeParams.fullName, 'i') };
    }

    if (safeParams.role && typeof safeParams.role === 'string') {
      query.roles = safeParams.role;
    }

    return this.personModel
      .find(query)
      .sort({ fullName: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<PersonDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid person ID format');
    }

    const person = await this.personModel
      .findOne({ _id: validId, isPublished: true })
      .lean()
      .exec();
    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return person as PersonDocument;
  }

  async update(
    id: string,
    updatePersonDto: UpdatePersonDto,
  ): Promise<PersonDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid person ID format');
    }

    await this.validateRefs(updatePersonDto.userId, updatePersonDto.photoId);

    const person = await this.personModel
      .findByIdAndUpdate(validId, updatePersonDto, { new: true })
      .lean()
      .exec();
    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return person as PersonDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid person ID format');
    }

    const result = await this.personModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Person not found');
    }

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.personModel.countDocuments({ _id: validId });
    return count > 0;
  }

  private async validateRefs(userId?: string, photoId?: string): Promise<void> {
    if (userId) {
      const user = await this.usersService.getById(userId);
      if (!user) {
        throw new BadRequestException('Referenced user not found');
      }
    }

    if (photoId) {
      const mediaExists = await this.mediaService.exists(photoId);
      if (!mediaExists) {
        throw new BadRequestException('Referenced media not found');
      }
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
