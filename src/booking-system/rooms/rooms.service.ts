import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { CompaniesService } from '../companies/companies.service';
import {
  validateObjectId,
  safeFindParams,
} from '../../common/utils/mongo-sanitizer';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomQueryParams } from '../shared/types/query-params.interface';

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private companiesService: CompaniesService,
  ) {}

  async create(createRoomDto: CreateRoomDto): Promise<RoomDocument> {
    try {
      const company = await this.companiesService.findOne(
        createRoomDto.company,
      );
      if (!company) {
        throw new BadRequestException('Company not found');
      }

      const existingRoom = await this.roomModel.findOne({
        company: createRoomDto.company,
        name: { $regex: new RegExp(`^${createRoomDto.name}$`, 'i') },
      });

      if (existingRoom) {
        throw new ConflictException(
          'Room with this name already exists in the company',
        );
      }

      const room = new this.roomModel(createRoomDto);
      return await room.save();
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(`Failed to create room: ${error.message}`);
    }
  }

  async findAll(queryParams: RoomQueryParams = {}): Promise<RoomDocument[]> {
    const safeParams = safeFindParams(queryParams);

    const query: any = {};

    if (safeParams.company && typeof safeParams.company === 'string') {
      const validCompanyId = validateObjectId(safeParams.company);
      if (validCompanyId) {
        query.company = validCompanyId;
      }
    }

    if (safeParams.isActive !== undefined) {
      query.isActive = safeParams.isActive === 'true';
    }

    if (safeParams.name && typeof safeParams.name === 'string') {
      query.name = { $regex: new RegExp(safeParams.name, 'i') };
    }

    if (safeParams.minCapacity && typeof safeParams.minCapacity === 'string') {
      query.capacity = { $gte: parseInt(safeParams.minCapacity) };
    }

    if (safeParams.maxCapacity && typeof safeParams.maxCapacity === 'string') {
      query.capacity = {
        ...query.capacity,
        $lte: parseInt(safeParams.maxCapacity),
      };
    }

    if (safeParams.amenities) {
      const amenitiesArray = Array.isArray(safeParams.amenities)
        ? safeParams.amenities
        : [safeParams.amenities];
      query.amenities = { $in: amenitiesArray };
    }

    return this.roomModel
      .find(query)
      .populate('company', 'name address')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<RoomDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid room ID format');
    }

    const room = await this.roomModel
      .findById(validId)
      .populate('company', 'name address phone email')
      .lean()
      .exec();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room as RoomDocument;
  }

  async findByCompany(companyId: string): Promise<RoomDocument[]> {
    const validCompanyId = validateObjectId(companyId);
    if (!validCompanyId) {
      throw new BadRequestException('Invalid company ID format');
    }

    const company = await this.companiesService.findOne(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.roomModel
      .find({ company: validCompanyId, isActive: true })
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    updateRoomDto: UpdateRoomDto,
  ): Promise<RoomDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid room ID format');
    }

    if (updateRoomDto.company) {
      const company = await this.companiesService.findOne(
        updateRoomDto.company,
      );
      if (!company) {
        throw new BadRequestException('Company not found');
      }
    }

    if (updateRoomDto.name) {
      const existingRoom = await this.roomModel.findOne({
        company: updateRoomDto.company || (await this.findOne(id)).company,
        name: { $regex: new RegExp(`^${updateRoomDto.name}$`, 'i') },
        _id: { $ne: validId },
      });

      if (existingRoom) {
        throw new ConflictException(
          'Room with this name already exists in the company',
        );
      }
    }

    const room = await this.roomModel
      .findByIdAndUpdate(validId, updateRoomDto, { new: true })
      .populate('company', 'name address')
      .lean()
      .exec();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room as RoomDocument;
  }

  async remove(id: string): Promise<boolean> {
    const validId = validateObjectId(id);
    if (!validId) {
      throw new NotFoundException('Invalid room ID format');
    }

    const result = await this.roomModel.findByIdAndDelete(validId).exec();
    if (!result) {
      throw new NotFoundException('Room not found');
    }

    return true;
  }

  async getActiveRooms(): Promise<RoomDocument[]> {
    return this.roomModel
      .find({ isActive: true })
      .populate('company', 'name')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findByCapacityRange(
    minCapacity: number,
    maxCapacity: number,
  ): Promise<RoomDocument[]> {
    const query: any = {
      isActive: true,
      capacity: { $gte: minCapacity },
    };

    if (maxCapacity) {
      query.capacity.$lte = maxCapacity;
    }

    return this.roomModel
      .find(query)
      .populate('company', 'name')
      .sort({ capacity: 1, name: 1 })
      .lean()
      .exec();
  }
}
