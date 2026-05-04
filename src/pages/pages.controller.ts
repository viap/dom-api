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
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PagesService } from './pages.service';
import { createPageSchema } from './schemas/joi.create-page.schema';
import {
  pageDomainPageParamsSchema,
  pageDomainParamsSchema,
  pageGlobalPageParamsSchema,
} from './schemas/joi.page-domain.params.schema';
import { pageAdminDomainQuerySchema } from './schemas/joi.page-admin-domain-query.schema';
import { pageDomainQuerySchema } from './schemas/joi.page-domain-query.schema';
import { pageGlobalQuerySchema } from './schemas/joi.page-global-query.schema';
import { pageQuerySchema } from './schemas/joi.page-query.schema';
import { updatePageSchema } from './schemas/joi.update-page.schema';
import { PageQueryParams } from './types/query-params.interface';

@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  @Public()
  findAll(
    @Query(new JoiValidationPipe(pageQuerySchema))
    query: PageQueryParams,
  ) {
    return this.pagesService.findAll(query);
  }

  @Get('admin/global')
  @Roles(Role.Admin, Role.Editor)
  findAllGlobal(
    @Query(new JoiValidationPipe(pageGlobalQuerySchema))
    query: {
      limit?: string;
      offset?: string;
    },
  ) {
    return this.pagesService.findAllGlobal(query);
  }

  @Get('admin/all')
  @Roles(Role.Admin, Role.Editor)
  findAllAdmin(
    @Query(new JoiValidationPipe(pageGlobalQuerySchema))
    query: {
      limit?: string;
      offset?: string;
    },
  ) {
    return this.pagesService.findAllAdmin(query);
  }

  @Get('admin/domain')
  @Roles(Role.Admin, Role.Editor)
  findAllByDomainIdAdmin(
    @Query(new JoiValidationPipe(pageAdminDomainQuerySchema))
    query: {
      domainId?: string;
      limit?: string;
      offset?: string;
    },
  ) {
    return this.pagesService.findAllByDomainIdAdmin(query);
  }

  @Get('admin/:id')
  @Roles(Role.Admin, Role.Editor)
  findAdminOne(@Param('id') id: string) {
    return this.pagesService.findAdminOne(id);
  }

  @Get('domain/:domainSlug')
  @Public()
  findAllByDomainSlug(
    @Param(new JoiValidationPipe(pageDomainParamsSchema))
    params: { domainSlug: string },
    @Query(new JoiValidationPipe(pageDomainQuerySchema))
    query: { limit?: string; offset?: string },
  ) {
    return this.pagesService.findAllByDomainSlug(params.domainSlug, query);
  }

  @Get('global/home')
  @Public()
  findGlobalHomepage() {
    return this.pagesService.findGlobalHomepage();
  }

  @Get('global/:pageSlug')
  @Public()
  findOneGlobalBySlug(
    @Param(new JoiValidationPipe(pageGlobalPageParamsSchema))
    params: {
      pageSlug: string;
    },
  ) {
    return this.pagesService.findOneGlobalBySlug(params.pageSlug);
  }

  @Get('domain/:domainSlug/home')
  @Public()
  findDomainHomepage(
    @Param(new JoiValidationPipe(pageDomainParamsSchema))
    params: {
      domainSlug: string;
    },
  ) {
    return this.pagesService.findDomainHomepage(params.domainSlug);
  }

  @Get('domain/:domainSlug/:pageSlug')
  @Public()
  findOneByDomainSlugAndPageSlug(
    @Param(new JoiValidationPipe(pageDomainPageParamsSchema))
    params: {
      domainSlug: string;
      pageSlug: string;
    },
  ) {
    return this.pagesService.findOneByDomainSlugAndPageSlug(
      params.domainSlug,
      params.pageSlug,
    );
  }

  @Get(':id([0-9a-fA-F]{24})')
  @Public()
  findOne(@Param('id') id: string) {
    return this.pagesService.findOne(id);
  }

  @Post()
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createPageSchema))
    createPageDto: CreatePageDto,
  ) {
    return this.pagesService.create(createPageDto);
  }

  @Patch(':id([0-9a-fA-F]{24})')
  @Roles(Role.Admin, Role.Editor)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updatePageSchema))
    updatePageDto: UpdatePageDto,
  ) {
    return this.pagesService.update(id, updatePageDto);
  }

  @Delete(':id([0-9a-fA-F]{24})')
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }
}
