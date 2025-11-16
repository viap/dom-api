import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JoiValidationPipe } from '../../joi/joi.pipe';
import { createCompanySchema } from './schemas/joi.create-company.schema';
import { updateCompanySchema } from './schemas/joi.update-company.schema';
import { Roles } from '../../roles/decorators/role.docorator';
import { Role } from '../../roles/enums/roles.enum';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryParams } from '../shared/types/query-params.interface';

@Controller('booking-system/companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /**
   * Create a new company
   * @param createCompanyDto Company data
   * @returns Created company
   *
   * Example request:
   * POST /booking-system/companies
   * {
   *   "name": "Tech Solutions Inc",
   *   "description": "Leading technology solutions provider",
   *   "address": "123 Tech Street, Silicon Valley, CA 94000",
   *   "phone": "+1-555-123-4567",
   *   "email": "contact@techsolutions.com",
   *   "website": "https://techsolutions.com",
   *   "settings": {
   *     "defaultBookingDuration": 60,
   *     "advanceBookingDays": 30,
   *     "timeZone": "America/Los_Angeles"
   *   }
   * }
   */
  @Post()
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createCompanySchema))
    createCompanyDto: CreateCompanyDto,
  ) {
    return this.companiesService.create(createCompanyDto);
  }

  /**
   * Get all companies with optional filtering
   * @param query Query parameters for filtering
   * @returns Array of companies
   *
   * Example requests:
   * GET /booking-system/companies
   * GET /booking-system/companies?isActive=true
   * GET /booking-system/companies?name=tech
   */
  @Get()
  findAll(@Query() query: CompanyQueryParams) {
    return this.companiesService.findAll(query);
  }

  /**
   * Get active companies only
   * @returns Array of active companies
   *
   * Example request:
   * GET /booking-system/companies/active
   */
  @Get('active')
  getActiveCompanies() {
    return this.companiesService.getActiveCompanies();
  }

  /**
   * Get a specific company by ID
   * @param id Company ID
   * @returns Company details
   *
   * Example request:
   * GET /booking-system/companies/507f1f77bcf86cd799439011
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  /**
   * Update a company
   * @param id Company ID
   * @param updateCompanyDto Updated company data
   * @returns Updated company
   *
   * Example request:
   * PATCH /booking-system/companies/507f1f77bcf86cd799439011
   * {
   *   "name": "Tech Solutions Corporation",
   *   "phone": "+1-555-123-9999",
   *   "settings": {
   *     "defaultBookingDuration": 90
   *   }
   * }
   */
  @Patch(':id')
  @Roles(Role.Admin)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateCompanySchema))
    updateCompanyDto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, updateCompanyDto);
  }

  /**
   * Delete a company
   * @param id Company ID
   *
   * Example request:
   * DELETE /booking-system/companies/507f1f77bcf86cd799439011
   */
  @Delete(':id')
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
