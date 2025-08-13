import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from './schemas/company.schema';
import {
  validateObjectId,
  safeFindParams,
} from '../../common/utils/mongo-sanitizer';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryParams } from '../shared/types/query-params.interface';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<CompanyDocument> {
    try {
      const existingCompany = await this.companyModel.findOne({
        name: { $regex: new RegExp(`^${createCompanyDto.name}$`, 'i') },
      });

      if (existingCompany) {
        throw new ConflictException('Company with this name already exists');
      }

      const company = new this.companyModel(createCompanyDto);
      return await company.save();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Failed to create company: ${error.message}`);
    }
  }

  async findAll(
    queryParams: CompanyQueryParams = {},
  ): Promise<CompanyDocument[]> {
    const safeParams = safeFindParams(queryParams);

    const query: any = {};

    if (safeParams.isActive !== undefined) {
      query.isActive = safeParams.isActive === 'true';
    }

    if (safeParams.name && typeof safeParams.name === 'string') {
      query.name = { $regex: new RegExp(safeParams.name, 'i') };
    }

    return this.companyModel.find(query).sort({ name: 1 }).lean().exec();
  }

  async findOne(id: string): Promise<CompanyDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid company ID format');
    }

    const company = await this.companyModel.findById(validId).lean().exec();
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company as CompanyDocument;
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
  ): Promise<CompanyDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid company ID format');
    }

    if (updateCompanyDto.name) {
      const existingCompany = await this.companyModel.findOne({
        name: { $regex: new RegExp(`^${updateCompanyDto.name}$`, 'i') },
        _id: { $ne: validId },
      });

      if (existingCompany) {
        throw new ConflictException('Company with this name already exists');
      }
    }

    const company = await this.companyModel
      .findByIdAndUpdate(validId, updateCompanyDto, { new: true })
      .lean()
      .exec();

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company as CompanyDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);

    if (!validId) {
      throw new NotFoundException('Invalid company ID format');
    }

    const result = await this.companyModel.findByIdAndDelete(validId).exec();

    if (!result) {
      throw new NotFoundException('Company not found');
    }

    return true;
  }

  async findByName(name: string): Promise<CompanyDocument | null> {
    return this.companyModel
      .findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
      .lean()
      .exec() as Promise<CompanyDocument | null>;
  }

  async getActiveCompanies(): Promise<CompanyDocument[]> {
    return this.companyModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .lean()
      .exec();
  }
}
