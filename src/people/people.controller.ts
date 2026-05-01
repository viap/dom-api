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
} from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PeopleService } from './people.service';
import { createPersonSchema } from './schemas/joi.create-person.schema';
import { personQuerySchema } from './schemas/joi.person-query.schema';
import { personSlugParamsSchema } from './schemas/joi.person-slug.params.schema';
import { updatePersonSchema } from './schemas/joi.update-person.schema';
import { PersonQueryParams } from './types/query-params.interface';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  @Public()
  findAll(
    @Query(new JoiValidationPipe(personQuerySchema))
    query: PersonQueryParams,
  ) {
    return this.peopleService.findAll(query);
  }

  @Get('admin')
  @Roles(Role.Admin, Role.Editor)
  findAllAdmin(
    @Query(new JoiValidationPipe(personQuerySchema))
    query: PersonQueryParams,
  ) {
    return this.peopleService.findAllAdmin(query);
  }

  @Get('admin/:id')
  @Roles(Role.Admin, Role.Editor)
  findOneAdmin(@Param('id') id: string) {
    return this.peopleService.findOneAdmin(id);
  }

  // Keep this specific slug route above the ObjectId route below.
  @Get('slug/:slug')
  @Public()
  findOneBySlug(
    @Param(new JoiValidationPipe(personSlugParamsSchema))
    params: {
      slug: string;
    },
  ) {
    return this.peopleService.findOneBySlug(params.slug);
  }

  @Get(':id([0-9a-fA-F]{24})')
  @Public()
  findOne(@Param('id') id: string) {
    return this.peopleService.findOne(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createPersonSchema))
    createPersonDto: CreatePersonDto,
  ) {
    return this.peopleService.create(createPersonDto);
  }

  @Patch(':id([0-9a-fA-F]{24})')
  @Roles(Role.Admin, Role.Editor)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updatePersonSchema))
    updatePersonDto: UpdatePersonDto,
  ) {
    return this.peopleService.update(id, updatePersonDto);
  }

  @Delete(':id([0-9a-fA-F]{24})')
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.peopleService.remove(id);
  }
}
