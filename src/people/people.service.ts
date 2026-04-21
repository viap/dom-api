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
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
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

  async findAllAdmin(
    queryParams: PersonQueryParams = {},
  ): Promise<PersonDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);
    const query: Record<string, unknown> = {};

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

  async findOneAdmin(id: string): Promise<PersonDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid person ID format');
    }

    const person = await this.personModel.findById(validId).lean().exec();
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

  async existingIds(ids: string[]): Promise<Set<string>> {
    return resolveExistingIds(this.personModel, ids);
  }

  async findPublishedSummariesByIds(
    ids: string[],
  ): Promise<Array<{ _id: string; fullName: string }>> {
    const validIds = ids
      .map((id) => validateObjectId(id))
      .filter((id): id is string => Boolean(id));

    if (!validIds.length) {
      return [];
    }

    const people = await this.personModel
      .find({ _id: { $in: validIds }, isPublished: true })
      .select({ _id: 1, fullName: 1 })
      .lean()
      .exec();

    return people.map((person) => ({
      _id: person._id.toString(),
      fullName: person.fullName,
    }));
  }

  private async validateRefs(userId?: string, photoId?: string): Promise<void> {
    if (userId) {
      const user = await this.usersService.getById(userId);
      if (!user) {
        throw new BadRequestException('Referenced user not found');
      }
    }

    if (photoId) {
      const mediaExists = await this.mediaService.existsPublished(photoId);
      if (!mediaExists) {
        throw new BadRequestException('Referenced published media not found');
      }
    }
  }
}
