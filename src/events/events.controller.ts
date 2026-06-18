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
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';
import { createEventSchema } from './schemas/joi.create-event.schema';
import { eventDomainEventParamsSchema } from './schemas/joi.event-params.schema';
import { eventQuerySchema } from './schemas/joi.event-query.schema';
import { updateEventSchema } from './schemas/joi.update-event.schema';
import { EventQueryParams } from './types/query-params.interface';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Public()
  findAll(
    @Query(new JoiValidationPipe(eventQuerySchema))
    query: EventQueryParams,
  ) {
    return this.eventsService.findAll(query);
  }

  @Get('domain/:domainSlug/:eventSlug')
  @Public()
  findOneByDomainSlugAndEventSlug(
    @Param(new JoiValidationPipe(eventDomainEventParamsSchema))
    params: {
      domainSlug: string;
      eventSlug: string;
    },
  ) {
    return this.eventsService.findOneByDomainSlugAndEventSlug(
      params.domainSlug,
      params.eventSlug,
    );
  }

  @Get(':id([0-9a-fA-F]{24})')
  @Public()
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Post('bulk')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  findMany(@Body(new JoiValidationPipe(bulkIdsSchema)) body: BulkIdsRequest) {
    return this.eventsService.findManyByIds(body.ids);
  }

  @Post()
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createEventSchema))
    createEventDto: CreateEventDto,
  ) {
    return this.eventsService.create(createEventDto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Editor)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateEventSchema))
    updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Editor)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
