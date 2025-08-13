import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  Schedule,
  ScheduleDocument,
  ScheduleType,
  RecurrencePattern,
} from './schemas/schedule.schema';
import { RoomsService } from '../rooms/rooms.service';
import { CompaniesService } from '../companies/companies.service';
import {
  validateObjectId,
  safeFindParams,
  sanitizeDateRange,
} from '../../common/utils/mongo-sanitizer';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleQueryParams } from '../shared/types/query-params.interface';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    private roomsService: RoomsService,
    private companiesService: CompaniesService,
  ) {}

  async create(
    createScheduleDto: CreateScheduleDto,
  ): Promise<ScheduleDocument> {
    try {
      if (createScheduleDto.room) {
        const room = await this.roomsService.findOne(createScheduleDto.room);
        if (!room) {
          throw new BadRequestException('Room not found');
        }
      }

      if (createScheduleDto.company) {
        const company = await this.companiesService.findOne(
          createScheduleDto.company,
        );
        if (!company) {
          throw new BadRequestException('Company not found');
        }
      }

      const schedule = new this.scheduleModel(createScheduleDto);
      return await schedule.save();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error(`Failed to create schedule: ${error.message}`);
    }
  }

  async findAll(
    queryParams: ScheduleQueryParams = {},
  ): Promise<ScheduleDocument[]> {
    const safeParams = safeFindParams(queryParams);
    const query: FilterQuery<ScheduleDocument> = {};

    if (safeParams.room && typeof safeParams.room === 'string') {
      const validRoomId = validateObjectId(safeParams.room);
      if (validRoomId) {
        query.room = validRoomId;
      }
    }

    if (safeParams.company && typeof safeParams.company === 'string') {
      const validCompanyId = validateObjectId(safeParams.company);
      if (validCompanyId) {
        query.company = validCompanyId;
      }
    }

    if (safeParams.type) {
      query.type = safeParams.type;
    }

    if (safeParams.isActive !== undefined) {
      query.isActive = safeParams.isActive === 'true';
    }

    if (safeParams.startDate || safeParams.endDate) {
      const { from, to } = sanitizeDateRange(
        safeParams.startDate as string,
        safeParams.endDate as string,
      );
      query.startDate = {};
      if (from) query.startDate.$gte = from;
      if (to) query.startDate.$lte = to;
    }

    return this.scheduleModel
      .find(query)
      .populate('room', 'name capacity')
      .populate('company', 'name')
      .sort({ startDate: 1, startTime: 1 })
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<ScheduleDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid schedule ID format');
    }

    const schedule = await this.scheduleModel
      .findById(validId)
      .populate('room', 'name capacity location company')
      .populate('company', 'name address')
      .lean()
      .exec();

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule as ScheduleDocument;
  }

  async findByRoom(
    roomId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ScheduleDocument[]> {
    const validRoomId = validateObjectId(roomId);
    if (!validRoomId) {
      throw new BadRequestException('Invalid room ID format');
    }

    const room = await this.roomsService.findOne(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const query: Record<string, unknown> = {
      room: validRoomId,
      isActive: true,
    };

    if (startDate || endDate) {
      const { from, to } = sanitizeDateRange(
        startDate?.toISOString(),
        endDate?.toISOString(),
      );
      query.$or = [
        // Schedules that start within the date range
        {
          startDate: {
            $gte: from || new Date('1970-01-01'),
            $lte: to || new Date('2099-12-31'),
          },
        },
        // Recurring schedules that might have instances in the date range
        {
          recurrencePattern: { $ne: RecurrencePattern.NONE },
          startDate: { $lte: to || new Date('2099-12-31') },
          $or: [
            { recurrenceEndDate: { $gte: from || new Date('1970-01-01') } },
            { recurrenceEndDate: { $exists: false } },
          ],
        },
      ];
    }

    return this.scheduleModel
      .find(query)
      .sort({ startDate: 1, startTime: 1 })
      .lean()
      .exec();
  }

  async findByCompany(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ScheduleDocument[]> {
    const validCompanyId = validateObjectId(companyId);
    if (!validCompanyId) {
      throw new BadRequestException('Invalid company ID format');
    }

    const company = await this.companiesService.findOne(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const query: FilterQuery<ScheduleDocument> = {
      $or: [
        { company: validCompanyId },
        { room: { $in: await this.getRoomIdsByCompany(companyId) } },
      ],
      isActive: true,
    };

    if (startDate || endDate) {
      const { from, to } = sanitizeDateRange(
        startDate?.toISOString(),
        endDate?.toISOString(),
      );
      query.startDate = {};
      if (from) query.startDate.$gte = from;
      if (to) query.startDate.$lte = to;
    }

    return this.scheduleModel
      .find(query)
      .populate('room', 'name capacity')
      .sort({ startDate: 1, startTime: 1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    updateScheduleDto: UpdateScheduleDto,
  ): Promise<ScheduleDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid schedule ID format');
    }

    if (updateScheduleDto.room) {
      const room = await this.roomsService.findOne(updateScheduleDto.room);
      if (!room) {
        throw new BadRequestException('Room not found');
      }
    }

    if (updateScheduleDto.company) {
      const company = await this.companiesService.findOne(
        updateScheduleDto.company,
      );
      if (!company) {
        throw new BadRequestException('Company not found');
      }
    }

    const schedule = await this.scheduleModel
      .findByIdAndUpdate(validId, updateScheduleDto, { new: true })
      .populate('room', 'name capacity')
      .populate('company', 'name')
      .lean()
      .exec();

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule as ScheduleDocument;
  }

  async remove(id: string): Promise<void> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid schedule ID format');
    }

    const result = await this.scheduleModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Schedule not found');
    }
  }

  async getWorkingHours(
    roomId: string,
    date: Date,
  ): Promise<ScheduleDocument[]> {
    const validRoomId = validateObjectId(roomId);
    if (!validRoomId) {
      throw new BadRequestException('Invalid room ID format');
    }

    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    return this.scheduleModel
      .find({
        room: validRoomId,
        type: ScheduleType.WORKING_HOURS,
        isActive: true,
        $or: [
          // Single day schedules
          {
            recurrencePattern: RecurrencePattern.NONE,
            startDate: { $lte: new Date(dateStr + 'T23:59:59.999Z') },
            $or: [
              { endDate: { $gte: new Date(dateStr + 'T00:00:00.000Z') } },
              { endDate: { $exists: false } },
            ],
          },
          // Daily recurring schedules
          {
            recurrencePattern: RecurrencePattern.DAILY,
            startDate: { $lte: new Date(dateStr + 'T23:59:59.999Z') },
            $or: [
              {
                recurrenceEndDate: {
                  $gte: new Date(dateStr + 'T00:00:00.000Z'),
                },
              },
              { recurrenceEndDate: { $exists: false } },
            ],
          },
          // Weekly recurring schedules
          {
            recurrencePattern: RecurrencePattern.WEEKLY,
            daysOfWeek: dayOfWeek,
            startDate: { $lte: new Date(dateStr + 'T23:59:59.999Z') },
            $or: [
              {
                recurrenceEndDate: {
                  $gte: new Date(dateStr + 'T00:00:00.000Z'),
                },
              },
              { recurrenceEndDate: { $exists: false } },
            ],
          },
        ],
      })
      .sort({ startTime: 1 })
      .lean()
      .exec();
  }

  async getUnavailableTimeSlots(
    roomId: string,
    date: Date,
  ): Promise<ScheduleDocument[]> {
    const validRoomId = validateObjectId(roomId);
    if (!validRoomId) {
      throw new BadRequestException('Invalid room ID format');
    }

    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    return this.scheduleModel
      .find({
        room: validRoomId,
        type: ScheduleType.UNAVAILABLE,
        isActive: true,
        $or: [
          // Single day unavailable periods
          {
            recurrencePattern: RecurrencePattern.NONE,
            startDate: { $lte: new Date(dateStr + 'T23:59:59.999Z') },
            $or: [
              { endDate: { $gte: new Date(dateStr + 'T00:00:00.000Z') } },
              { endDate: { $exists: false } },
            ],
          },
          // Recurring unavailable periods
          {
            recurrencePattern: { $ne: RecurrencePattern.NONE },
            startDate: { $lte: new Date(dateStr + 'T23:59:59.999Z') },
            $or: [
              {
                recurrenceEndDate: {
                  $gte: new Date(dateStr + 'T00:00:00.000Z'),
                },
              },
              { recurrenceEndDate: { $exists: false } },
            ],
            ...(dayOfWeek !== undefined && {
              $or: [
                { recurrencePattern: RecurrencePattern.DAILY },
                {
                  recurrencePattern: RecurrencePattern.WEEKLY,
                  daysOfWeek: dayOfWeek,
                },
              ],
            }),
          },
        ],
      })
      .sort({ startTime: 1 })
      .lean()
      .exec();
  }

  private async getRoomIdsByCompany(companyId: string): Promise<string[]> {
    const rooms = await this.roomsService.findByCompany(companyId);
    return rooms.map((room) => room._id.toString());
  }

  async isTimeSlotAvailable(
    roomId: string,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<boolean> {
    const workingHours = await this.getWorkingHours(roomId, date);
    const unavailableSlots = await this.getUnavailableTimeSlots(roomId, date);

    // Check if the requested time is within working hours
    const isWithinWorkingHours = workingHours.some(
      (wh) => startTime >= wh.startTime && endTime <= wh.endTime,
    );

    if (!isWithinWorkingHours) {
      return false;
    }

    // Check if the requested time overlaps with unavailable slots
    const hasConflict = unavailableSlots.some(
      (slot) => !(endTime <= slot.startTime || startTime >= slot.endTime),
    );

    return !hasConflict;
  }
}
