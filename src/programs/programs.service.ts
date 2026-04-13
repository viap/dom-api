import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  parsePaginationLimit,
  parsePaginationOffset,
} from '@/common/utils/pagination';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { DomainsService } from '@/domains/domains.service';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { ProgramStatus } from './enums/program-status.enum';
import { ProgramQueryParams } from './types/query-params.interface';
import { Program, ProgramDocument } from './schemas/program.schema';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
    private domainsService: DomainsService,
    private peopleService: PeopleService,
    private partnersService: PartnersService,
  ) {}

  async create(createProgramDto: CreateProgramDto): Promise<ProgramDocument> {
    await this.validateDomainAndRefs(createProgramDto);
    await this.ensureUniqueSlug(
      createProgramDto.domainId,
      createProgramDto.slug,
    );

    const program = new this.programModel(createProgramDto);
    return program.save();
  }

  async findAll(
    queryParams: ProgramQueryParams = {},
  ): Promise<ProgramDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const domainId =
      typeof safeParams.domainId === 'string' ? safeParams.domainId : null;
    if (!domainId) {
      throw new BadRequestException('domainId is required');
    }

    await this.domainsService.getActiveById(domainId);

    const limit = parsePaginationLimit(safeParams.limit);
    const offset = parsePaginationOffset(safeParams.offset);

    return this.programModel
      .find({
        domainId,
        status: { $ne: ProgramStatus.Draft },
      })
      .sort({ startDate: 1, title: 1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<ProgramDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid program ID format');
    }

    const program = await this.programModel
      .findOne({ _id: validId, status: { $ne: ProgramStatus.Draft } })
      .lean()
      .exec();
    if (!program) {
      throw new NotFoundException('Program not found');
    }

    return program as ProgramDocument;
  }

  async update(
    id: string,
    updateProgramDto: UpdateProgramDto,
  ): Promise<ProgramDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid program ID format');
    }

    const existingProgram = await this.programModel
      .findById(validId)
      .lean()
      .exec();
    if (!existingProgram) {
      throw new NotFoundException('Program not found');
    }

    const domainId =
      updateProgramDto.domainId || existingProgram.domainId.toString();
    const slug = updateProgramDto.slug || existingProgram.slug;

    await this.validateDomainAndRefs({
      domainId,
      speakerIds:
        updateProgramDto.speakerIds ||
        existingProgram.speakerIds.map((id) => id.toString()),
      organizerIds:
        updateProgramDto.organizerIds ||
        existingProgram.organizerIds.map((id) => id.toString()),
      partnerIds:
        updateProgramDto.partnerIds ||
        existingProgram.partnerIds.map((id) => id.toString()),
    });
    await this.ensureUniqueSlug(domainId, slug, validId);

    const program = await this.programModel
      .findByIdAndUpdate(validId, updateProgramDto, { new: true })
      .lean()
      .exec();

    return program as ProgramDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid program ID format');
    }

    const result = await this.programModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Program not found');
    }

    return true;
  }

  async exists(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      return false;
    }

    const count = await this.programModel.countDocuments({ _id: validId });
    return count > 0;
  }

  private async validateDomainAndRefs(data: {
    domainId: string;
    speakerIds?: string[];
    organizerIds?: string[];
    partnerIds?: string[];
  }): Promise<void> {
    await this.domainsService.getActiveById(data.domainId);

    await this.validatePeople(data.speakerIds || []);
    await this.validatePeople(data.organizerIds || []);
    await this.validatePartners(data.partnerIds || []);
  }

  private async validatePeople(ids: string[]): Promise<void> {
    for (const id of ids) {
      const exists = await this.peopleService.exists(id);
      if (!exists) {
        throw new BadRequestException(`Referenced person not found: ${id}`);
      }
    }
  }

  private async validatePartners(ids: string[]): Promise<void> {
    for (const id of ids) {
      const exists = await this.partnersService.exists(id);
      if (!exists) {
        throw new BadRequestException(`Referenced partner not found: ${id}`);
      }
    }
  }

  private async ensureUniqueSlug(
    domainId: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = { domainId, slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.programModel.findOne(query);
    if (existing) {
      throw new ConflictException(
        'Program with this slug already exists in the domain',
      );
    }
  }
}
