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
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { bulkIdsSchema } from '@/common/schemas/joi.bulk-ids.schema';
import { BulkIdsRequest } from '@/common/types/bulk-resolve.types';
import { withRequestCancellation } from '@/common/utils/with-request-cancellation';
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
  async findAll(
    @Query(new JoiValidationPipe(eventQuerySchema))
    query: EventQueryParams,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return withRequestCancellation(request, response, (signal) =>
      this.eventsService.findAll(query, signal),
    );
  }

  @Post('admin/bulk')
  @Roles(Role.Admin, Role.Editor)
  findManyAdmin(
    @Body(new JoiValidationPipe(bulkIdsSchema)) body: BulkIdsRequest,
  ) {
    return this.eventsService.findManyAdminByIds(body.ids);
  }

  @Get('admin')
  @Roles(Role.Admin, Role.Editor)
  findAllAdmin(
    @Query(new JoiValidationPipe(eventQuerySchema)) query: EventQueryParams,
  ) {
    return this.eventsService.findAllAdmin(query);
  }

  @Get('domain/:domainSlug/:eventSlug')
  @Public()
  async findOneByDomainSlugAndEventSlug(
    @Param(new JoiValidationPipe(eventDomainEventParamsSchema))
    params: {
      domainSlug: string;
      eventSlug: string;
    },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return withRequestCancellation(request, response, (signal) =>
      this.eventsService.findOneByDomainSlugAndEventSlug(
        params.domainSlug,
        params.eventSlug,
        signal,
      ),
    );
  }

  @Get(':id([0-9a-fA-F]{24})')
  @Public()
  async findOne(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return withRequestCancellation(request, response, (signal) =>
      this.eventsService.findOne(id, signal),
    );
  }

  @Post('bulk')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async findMany(
    @Body(new JoiValidationPipe(bulkIdsSchema)) body: BulkIdsRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return withRequestCancellation(request, response, (signal) =>
      this.eventsService.findManyByIds(body.ids, signal),
    );
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
