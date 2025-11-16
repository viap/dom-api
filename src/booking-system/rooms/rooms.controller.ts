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
import { RoomsService } from './rooms.service';
import { JoiValidationPipe } from '../../joi/joi.pipe';
import { createRoomSchema } from './schemas/joi.create-room.schema';
import { updateRoomSchema } from './schemas/joi.update-room.schema';
import { Roles } from '../../roles/decorators/role.docorator';
import { Role } from '../../roles/enums/roles.enum';

import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

import { RoomQueryParams } from '../shared/types/query-params.interface';

@Controller('booking-system/rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * Create a new room
   * @param createRoomDto Room data
   * @returns Created room
   *
   * Example request:
   * POST /booking-system/rooms
   * {
   *   "name": "Conference Room A",
   *   "description": "Large conference room with video conferencing",
   *   "company": "507f1f77bcf86cd799439011",
   *   "capacity": 12,
   *   "amenities": ["WiFi", "Projector", "Whiteboard"],
   *   "location": "2nd Floor, East Wing",
   *   "settings": {
   *     "allowMultipleBookings": false,
   *     "minimumBookingDuration": 30,
   *     "maximumBookingDuration": 480,
   *     "cleaningTimeAfterBooking": 15
   *   },
   *   "equipment": {
   *     "projector": true,
   *     "whiteboard": true,
   *     "videoConferencing": true,
   *     "wifi": true,
   *     "airConditioning": true
   *   }
   * }
   */
  @Post()
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new JoiValidationPipe(createRoomSchema)) createRoomDto: CreateRoomDto,
  ) {
    return this.roomsService.create(createRoomDto);
  }

  /**
   * Get all rooms with optional filtering
   * @param query Query parameters for filtering
   * @returns Array of rooms
   *
   * Example requests:
   * GET /booking-system/rooms
   * GET /booking-system/rooms?company=507f1f77bcf86cd799439011
   * GET /booking-system/rooms?minCapacity=10&maxCapacity=20
   * GET /booking-system/rooms?amenities=WiFi&amenities=Projector
   * GET /booking-system/rooms?isActive=true
   */
  @Get()
  findAll(@Query() query: RoomQueryParams) {
    return this.roomsService.findAll(query);
  }

  /**
   * Get active rooms only
   * @returns Array of active rooms
   *
   * Example request:
   * GET /booking-system/rooms/active
   */
  @Get('active')
  getActiveRooms() {
    return this.roomsService.getActiveRooms();
  }

  /**
   * Get rooms by capacity range
   * @param minCapacity Minimum capacity
   * @param maxCapacity Maximum capacity (optional)
   * @returns Array of rooms within capacity range
   *
   * Example requests:
   * GET /booking-system/rooms/capacity/10/20
   * GET /booking-system/rooms/capacity/5
   */
  @Get('capacity/:minCapacity/:maxCapacity?')
  findByCapacityRange(
    @Param('minCapacity') minCapacity: string,
    @Param('maxCapacity') maxCapacity?: string,
  ) {
    const min = parseInt(minCapacity);
    const max = maxCapacity ? parseInt(maxCapacity) : undefined;
    return this.roomsService.findByCapacityRange(min, max);
  }

  /**
   * Get rooms by company
   * @param companyId Company ID
   * @returns Array of rooms for the company
   *
   * Example request:
   * GET /booking-system/rooms/by-company/507f1f77bcf86cd799439011
   */
  @Get('by-company/:companyId')
  findByCompany(@Param('companyId') companyId: string) {
    return this.roomsService.findByCompany(companyId);
  }

  /**
   * Get a specific room by ID
   * @param id Room ID
   * @returns Room details
   *
   * Example request:
   * GET /booking-system/rooms/507f1f77bcf86cd799439012
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  /**
   * Update a room
   * @param id Room ID
   * @param updateRoomDto Updated room data
   * @returns Updated room
   *
   * Example request:
   * PATCH /booking-system/rooms/507f1f77bcf86cd799439012
   * {
   *   "name": "Conference Room A - Updated",
   *   "capacity": 15,
   *   "amenities": ["WiFi", "Projector", "Whiteboard", "Video Conference"],
   *   "settings": {
   *     "maximumBookingDuration": 360
   *   }
   * }
   */
  @Patch(':id')
  @Roles(Role.Admin)
  update(
    @Param('id') id: string,
    @Body(new JoiValidationPipe(updateRoomSchema)) updateRoomDto: UpdateRoomDto,
  ) {
    return this.roomsService.update(id, updateRoomDto);
  }

  /**
   * Delete a room
   * @param id Room ID
   *
   * Example request:
   * DELETE /booking-system/rooms/507f1f77bcf86cd799439012
   */
  @Delete(':id')
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.roomsService.remove(id);
  }
}
