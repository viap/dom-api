import {
  Body,
  Controller,
  Delete,
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
import { bulkIdsSchema } from '@/common/schemas/joi.bulk-ids.schema';
import { BulkIdsRequest } from '@/common/types/bulk-resolve.types';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { ProgramsService } from './programs.service';
import { createProgramSchema } from './schemas/joi.create-program.schema';
import { programQuerySchema } from './schemas/joi.program-query.schema';
import { updateProgramSchema } from './schemas/joi.update-program.schema';
import { ProgramQueryParams } from './types/query-params.interface';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  @Public()
  findAll(
    @Query(new JoiValidationPipe(programQuerySchema))
    query: ProgramQueryParams,
  ) {
    return this.programsService.findAll(query);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.programsService.findOne(id);
  }

  @Post('bulk')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  findMany(@Body(new JoiValidationPipe(bulkIdsSchema)) body: BulkIdsRequest) {
    return this.programsService.findManyByIds(body.ids);
  }

  @Post()
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createProgramSchema))
    createProgramDto: CreateProgramDto,
  ) {
    return this.programsService.create(createProgramDto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Editor)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateProgramSchema))
    updateProgramDto: UpdateProgramDto,
  ) {
    return this.programsService.update(id, updateProgramDto);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.programsService.remove(id);
  }
}
