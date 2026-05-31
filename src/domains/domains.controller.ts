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
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { bulkIdsSchema } from '@/common/schemas/joi.bulk-ids.schema';
import { BulkIdsRequest } from '@/common/types/bulk-resolve.types';
import { JoiValidationPipe } from '@/joi/joi.pipe';
import { Roles } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { DomainsService } from './domains.service';
import { createDomainSchema } from './schemas/joi.create-domain.schema';
import { domainSlugParamsSchema } from './schemas/joi.domain-slug.params.schema';
import { updateDomainSchema } from './schemas/joi.update-domain.schema';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  @Public()
  findAll() {
    return this.domainsService.findAll();
  }

  // Keep this specific slug route above the ObjectId route below.
  @Get('slug/:slug')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  findOneBySlug(
    @Param(new JoiValidationPipe(domainSlugParamsSchema))
    params: {
      slug: string;
    },
  ) {
    return this.domainsService.getActiveBySlug(params.slug);
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.domainsService.findOne(id);
  }

  @Post('bulk')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  findMany(@Body(new JoiValidationPipe(bulkIdsSchema)) body: BulkIdsRequest) {
    return this.domainsService.findManyByIds(body.ids);
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
