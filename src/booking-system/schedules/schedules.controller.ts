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
import { SchedulesService } from './schedules.service';
import { JoiValidationPipe } from '../../joi/joi.pipe';
import { createScheduleSchema } from './schemas/joi.create-schedule.schema';
import { updateScheduleSchema } from './schemas/joi.update-schedule.schema';
import { Roles } from '../../roles/decorators/role.docorator';
import { Role } from '../../roles/enums/roles.enum';

import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

import { ScheduleQueryParams } from '../shared/types/query-params.interface';

@Controller('booking-system/schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  /**
   * Create a new schedule (working hours or unavailable time)
   * @param createScheduleDto Schedule data
   * @returns Created schedule
   *
   * Example request for working hours:
   * POST /booking-system/schedules
   * {
   *   "name": "Monday-Friday Working Hours",
   *   "description": "Standard business hours for Conference Room A",
   *   "type": "working_hours",
   *   "room": "507f1f77bcf86cd799439012",
   *   "startDate": "2024-01-01T00:00:00.000Z",
   *   "startTime": "09:00",
   *   "endTime": "17:00",
   *   "recurrencePattern": "weekly",
   *   "daysOfWeek": [1, 2, 3, 4, 5],
   *   "timeZone": "America/New_York"
   * }
   *
   * Example request for unavailable time:
   * POST /booking-system/schedules
   * {
   *   "name": "Christmas Holiday",
   *   "description": "Office closed for Christmas",
   *   "type": "unavailable",
   *   "company": "507f1f77bcf86cd799439011",
   *   "startDate": "2024-12-25T00:00:00.000Z",
   *   "endDate": "2024-12-25T23:59:59.999Z",
   *   "startTime": "00:00",
   *   "endTime": "23:59",
   *   "metadata": {
   *     "reason": "Christmas Holiday",
   *     "color": "#FF0000"
   *   }
   * }
   */
  @Post()
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createScheduleSchema))
    createScheduleDto: CreateScheduleDto,
  ) {
    return this.schedulesService.create(createScheduleDto);
  }

  /**
   * Get all schedules with optional filtering
   * @param query Query parameters for filtering
   * @returns Array of schedules
   *
   * Example requests:
   * GET /booking-system/schedules
   * GET /booking-system/schedules?room=507f1f77bcf86cd799439012
   * GET /booking-system/schedules?company=507f1f77bcf86cd799439011
   * GET /booking-system/schedules?type=working_hours
   * GET /booking-system/schedules?startDate=2024-01-01&endDate=2024-01-31
   */
  @Get()
  findAll(@Query() query: ScheduleQueryParams) {
    return this.schedulesService.findAll(query);
  }

  /**
   * Get working hours for a specific room and date
   * @param roomId Room ID
   * @param date Date in YYYY-MM-DD format
   * @returns Array of working hour schedules
   *
   * Example request:
   * GET /booking-system/schedules/working-hours/507f1f77bcf86cd799439012/2024-01-15
   */
  @Get('working-hours/:roomId/:date')
  getWorkingHours(
    @Param('roomId') roomId: string,
    @Param('date') date: string,
  ) {
    const dateObj = new Date(date);
    return this.schedulesService.getWorkingHours(roomId, dateObj);
  }

  /**
   * Get unavailable time slots for a specific room and date
   * @param roomId Room ID
   * @param date Date in YYYY-MM-DD format
   * @returns Array of unavailable time schedules
   *
   * Example request:
   * GET /booking-system/schedules/unavailable/507f1f77bcf86cd799439012/2024-01-15
   */
  @Get('unavailable/:roomId/:date')
  getUnavailableTimeSlots(
    @Param('roomId') roomId: string,
    @Param('date') date: string,
  ) {
    const dateObj = new Date(date);
    return this.schedulesService.getUnavailableTimeSlots(roomId, dateObj);
  }

  /**
   * Check if a time slot is available for booking
   * @param roomId Room ID
   * @param date Date in YYYY-MM-DD format
   * @param startTime Start time in HH:MM format
   * @param endTime End time in HH:MM format
   * @returns Boolean indicating availability
   *
   * Example request:
   * GET /booking-system/schedules/availability/507f1f77bcf86cd799439012/2024-01-15?startTime=10:00&endTime=11:00
   */
  @Get('availability/:roomId/:date')
  checkAvailability(
    @Param('roomId') roomId: string,
    @Param('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    const dateObj = new Date(date);
    return this.schedulesService.isTimeSlotAvailable(
      roomId,
      dateObj,
      startTime,
      endTime,
    );
  }

  /**
   * Get schedules by room with optional date range
   * @param roomId Room ID
   * @param query Query parameters for date range
   * @returns Array of schedules for the room
   *
   * Example requests:
   * GET /booking-system/schedules/by-room/507f1f77bcf86cd799439012
   * GET /booking-system/schedules/by-room/507f1f77bcf86cd799439012?startDate=2024-01-01&endDate=2024-01-31
   */
  @Get('by-room/:roomId')
  findByRoom(
    @Param('roomId') roomId: string,
    @Query() query: ScheduleQueryParams,
  ) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    return this.schedulesService.findByRoom(roomId, startDate, endDate);
  }

  /**
   * Get schedules by company with optional date range
   * @param companyId Company ID
   * @param query Query parameters for date range
   * @returns Array of schedules for the company
   *
   * Example requests:
   * GET /booking-system/schedules/by-company/507f1f77bcf86cd799439011
   * GET /booking-system/schedules/by-company/507f1f77bcf86cd799439011?startDate=2024-01-01&endDate=2024-01-31
   */
  @Get('by-company/:companyId')
  findByCompany(
    @Param('companyId') companyId: string,
    @Query() query: ScheduleQueryParams,
  ) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    return this.schedulesService.findByCompany(companyId, startDate, endDate);
  }

  /**
   * Get a specific schedule by ID
   * @param id Schedule ID
   * @returns Schedule details
   *
   * Example request:
   * GET /booking-system/schedules/507f1f77bcf86cd799439013
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schedulesService.findOne(id);
  }

  /**
   * Update a schedule
   * @param id Schedule ID
   * @param updateScheduleDto Updated schedule data
   * @returns Updated schedule
   *
   * Example request:
   * PATCH /booking-system/schedules/507f1f77bcf86cd799439013
   * {
   *   "name": "Updated Working Hours",
   *   "startTime": "08:00",
   *   "endTime": "18:00",
   *   "metadata": {
   *     "reason": "Extended hours during busy season"
   *   }
   * }
   */
  @Patch(':id')
  @Roles(Role.Admin)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateScheduleSchema))
    updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, updateScheduleDto);
  }

  /**
   * Delete a schedule
   * @param id Schedule ID
   *
   * Example request:
   * DELETE /booking-system/schedules/507f1f77bcf86cd799439013
   */
  @Delete(':id')
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.schedulesService.remove(id);
  }
}
