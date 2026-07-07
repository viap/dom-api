import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
import { resolveExistingIds } from '@/common/utils/resolve-ids';
import {
  prepareBulkIds,
  toBulkResolveResponse,
} from '@/common/utils/bulk-resolve';
import { isMongoDuplicateSlugError } from '@/common/utils/mongo-duplicate-slug-error';
import { MediaService } from '@/media/media.service';
import { LocationsService } from '@/locations/locations.service';
import { UsersService } from '@/users/users.service';
import { BulkResolveResponse } from '@/common/types/bulk-resolve.types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { Person, PersonDocument } from './schemas/person.schema';
import { PersonQueryParams } from './types/query-params.interface';

@Injectable()
export class PeopleService {
  constructor(
    @InjectModel(Person.name) private personModel: Model<PersonDocument>,
    private usersService: UsersService,
    private mediaService: MediaService,
    private locationsService: LocationsService,
  ) {}

  async create(createPersonDto: CreatePersonDto): Promise<PersonDocument> {
    const createData = this.prepareCreateData(createPersonDto);
    await this.validateRefs(
      createData.userId,
      createData.photoId,
      createData.workLocationId,
    );
    await this.ensureUniqueSlug(createData.slug);

    const person = new this.personModel(createData);
    try {
      return await person.save();
    } catch (error) {
      if (isMongoDuplicateSlugError(error)) {
        throw new ConflictException('Person with this slug already exists');
      }
      throw error;
    }
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
      .populate('workLocationId')
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
      .populate('workLocationId')
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
      .populate('workLocationId')
      .lean()
      .exec();
    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return person as PersonDocument;
  }

  async findManyByIds(
    ids: string[],
  ): Promise<BulkResolveResponse<PersonDocument>> {
    const preparedIds = prepareBulkIds(ids);
    if (!preparedIds.validIds.length) {
      return {
        items: [],
      };
    }

    const people = await this.personModel
      .find({ _id: { $in: preparedIds.validIds }, isPublished: true })
      .populate('workLocationId')
      .lean()
      .exec();

    return toBulkResolveResponse({
      preparedIds,
      items: people as PersonDocument[],
      getId: (person) => person._id.toString(),
    });
  }

  async findOneBySlug(slug: string): Promise<PersonDocument> {
    const person = await this.personModel
      .findOne({ slug, isPublished: true })
      .populate('workLocationId')
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

    const person = await this.personModel
      .findById(validId)
      .populate('workLocationId')
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

    const updateData = this.prepareUpdateData(updatePersonDto);

    await this.validateRefs(
      updatePersonDto.userId,
      updatePersonDto.photoId,
      updatePersonDto.workLocationId || undefined,
    );

    if (updatePersonDto.slug !== undefined) {
      const existingPerson = await this.personModel
        .findById(validId)
        .lean()
        .exec();
      if (!existingPerson) {
        throw new NotFoundException('Person not found');
      }

      if (updatePersonDto.slug !== existingPerson.slug) {
        await this.ensureUniqueSlug(updatePersonDto.slug, validId);
      }
    }

    try {
      const person = await this.personModel
        .findByIdAndUpdate(validId, updateData, { new: true })
        .lean()
        .exec();
      if (!person) {
        throw new NotFoundException('Person not found');
      }

      return person as PersonDocument;
    } catch (error) {
      if (isMongoDuplicateSlugError(error)) {
        throw new ConflictException('Person with this slug already exists');
      }
      throw error;
    }
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

  private prepareCreateData(createPersonDto: CreatePersonDto): CreatePersonDto {
    const createData: CreatePersonDto = { ...createPersonDto };

    if (createData.title === null) {
      delete createData.title;
    }

    if (createData.workLocationId === null) {
      delete createData.workLocationId;
    }

    return createData;
  }

  private prepareUpdateData(
    updatePersonDto: UpdatePersonDto,
  ): Record<string, unknown> {
    const updateData: Record<string, unknown> = { ...updatePersonDto };
    const unsetData: Record<string, ''> = {};

    if (updatePersonDto.title === null) {
      delete updateData.title;
      unsetData.title = '';
    }

    if (updatePersonDto.workLocationId === null) {
      delete updateData.workLocationId;
      unsetData.workLocationId = '';
    }

    if (Object.keys(unsetData).length > 0) {
      updateData.$unset = unsetData;
    }

    return updateData;
  }

  private async validateRefs(
    userId?: string,
    photoId?: string,
    workLocationId?: string,
  ): Promise<void> {
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

    if (workLocationId) {
      const locationExists = await this.locationsService.exists(workLocationId);
      if (!locationExists) {
        throw new BadRequestException('Referenced work location not found');
      }
    }
  }

  private async ensureUniqueSlug(
    slug?: string,
    excludeId?: string,
  ): Promise<void> {
    if (!slug) {
      return;
    }

    const query: FilterQuery<PersonDocument> = { slug };
    if (excludeId) {
      query._id = { $ne: new Types.ObjectId(excludeId) };
    }

    const existing = await this.personModel.findOne(query).lean().exec();
    if (existing) {
      throw new ConflictException('Person with this slug already exists');
    }
  }
}
