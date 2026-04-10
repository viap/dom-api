import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { applicationQuerySchema } from './schemas/joi.application-query.schema';
import { createApplicationSchema } from './schemas/joi.create-application.schema';
import { updateApplicationSchema } from './schemas/joi.update-application.schema';
import { ApplicationQueryParams } from './types/query-params.interface';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createApplicationSchema))
    createApplicationDto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(createApplicationDto);
  }

  @Get()
  @Roles(Role.Admin, Role.Editor)
  findAll(
    @Query(new JoiValidationPipe(applicationQuerySchema))
    query: ApplicationQueryParams,
  ) {
    return this.applicationsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Editor)
  findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Editor)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateApplicationSchema))
    updateApplicationDto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(id, updateApplicationDto);
  }
}
