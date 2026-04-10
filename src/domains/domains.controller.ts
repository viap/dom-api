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
} from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { DomainsService } from './domains.service';
import { createDomainSchema } from './schemas/joi.create-domain.schema';
import { updateDomainSchema } from './schemas/joi.update-domain.schema';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  @Public()
  findAll() {
    return this.domainsService.findAll();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.domainsService.findOne(id);
  }

  @Post()
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createDomainSchema))
    createDomainDto: CreateDomainDto,
  ) {
    return this.domainsService.create(createDomainDto);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateDomainSchema))
    updateDomainDto: UpdateDomainDto,
  ) {
    return this.domainsService.update(id, updateDomainDto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.domainsService.remove(id);
  }
}
