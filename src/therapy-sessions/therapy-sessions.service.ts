import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PsychologistsService } from 'src/psychologists/psychologists.service';
import { UsersService } from 'src/users/users.service';
import { CreateTherapySessionDto } from './dto/create-therapy-session.dto';
import { UpdateTherapySessionDto } from './dto/update-therapy-session.dto';
import {
  TherapySession,
  TherapySessionDocument,
} from './schemas/therapy-session.schema';
import { PsychologistDocument } from 'src/psychologists/schemas/psychologist.schema';

const submodels = ['psychologist', 'client'];

@Injectable()
export class TherapySessionsService {
  constructor(
    @InjectModel(TherapySession.name)
    private therapySessionModel: Model<TherapySession>,
    private psychologistsService: PsychologistsService,
    private usersService: UsersService,
  ) {}

  async getAll(): Promise<Array<TherapySessionDocument>> {
    return this.therapySessionModel.find().populate(submodels).exec();
  }

  async getById(id: string): Promise<TherapySessionDocument> {
    return this.therapySessionModel.findById(id).populate(submodels).exec();
  }

  async getAllForPsychologist(
    psychologistId: string,
  ): Promise<Array<TherapySessionDocument>> {
    try {
      return await this.therapySessionModel
        .find({ psychologist: psychologistId })
        .populate(submodels)
        .exec();
    } catch {
      return [];
    }
  }

  async getAllForPsychologistAndClient(
    psychologistId: string,
    clientId: string,
  ): Promise<Array<TherapySessionDocument>> {
    try {
      return await this.therapySessionModel
        .find({ psychologist: psychologistId, client: clientId })
        .populate(submodels)
        .exec();
    } catch {
      return [];
    }
  }

  async create(
    createData: CreateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    const psychologist = await this.psychologistsService.getById(
      createData.psychologist,
    );

    return this.createFor(psychologist, createData);
  }

  async createFor(
    psychologist: PsychologistDocument,
    createData: CreateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    const client = await this.usersService.getById(createData.client);
    return this.therapySessionModel.create({
      ...createData,
      psychologist: psychologist._id,
      client: client._id,
    });
  }

  async update(
    id: string,
    updateData: UpdateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    await this.therapySessionModel.findByIdAndUpdate(id, updateData);
    return this.getById(id);
  }

  async remove(id: string): Promise<boolean> {
    return !!(await this.therapySessionModel.findByIdAndRemove(id));
  }
}
