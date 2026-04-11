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
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenusService } from './menus.service';
import { createMenuSchema } from './schemas/joi.create-menu.schema';
import { menuAdminQuerySchema } from './schemas/joi.menu-admin-query.schema';
import {
  menuDomainKeyParamsSchema,
  menuKeyParamsSchema,
} from './schemas/joi.menu-key-params.schema';
import { updateMenuSchema } from './schemas/joi.update-menu.schema';
import { MenuAdminQueryParams } from './types/admin-query-params.interface';

@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get()
  @Roles(Role.Admin, Role.Editor)
  findAll(
    @Query(new JoiValidationPipe(menuAdminQuerySchema))
    query: MenuAdminQueryParams,
  ) {
    return this.menusService.findAll(query);
  }

  @Get('domain/:domainSlug/:key')
  @Public()
  findPublicByDomainAndKey(
    @Param(new JoiValidationPipe(menuDomainKeyParamsSchema))
    params: { domainSlug: string; key: string },
  ) {
    return this.menusService.findPublicByDomainAndKey(
      params.domainSlug,
      params.key,
    );
  }

  @Get(':id([0-9a-fA-F]{24})')
  @Roles(Role.Admin, Role.Editor)
  findOne(@Param('id') id: string) {
    return this.menusService.findOne(id);
  }

  @Get(':key')
  @Public()
  findPublicGlobalByKey(
    @Param(new JoiValidationPipe(menuKeyParamsSchema))
    params: { key: string },
  ) {
    return this.menusService.findPublicGlobalByKey(params.key);
  }

  @Post()
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createMenuSchema))
    createMenuDto: CreateMenuDto,
  ) {
    return this.menusService.create(createMenuDto);
  }

  @Patch(':id([0-9a-fA-F]{24})')
  @Roles(Role.Admin, Role.Editor)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateMenuSchema))
    updateMenuDto: UpdateMenuDto,
  ) {
    return this.menusService.update(id, updateMenuDto);
  }

  @Delete(':id([0-9a-fA-F]{24})')
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.menusService.remove(id);
  }
}
