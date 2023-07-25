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

@Injectable()
export class TherapySessionsService {
  constructor(
    @InjectModel(TherapySession.name)
    private therapySessionModel: Model<TherapySession>,
    private psychologistsService: PsychologistsService,
    private usersService: UsersService,
  ) {}

  async getAll(): Promise<Array<TherapySessionDocument>> {
    return this.therapySessionModel.find().exec();
  }

  async getAllForPsychologist(
    psychologistId: string,
  ): Promise<Array<TherapySessionDocument>> {
    try {
      return await this.therapySessionModel
        .find({ psychologist: psychologistId })
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
        .exec();
    } catch {
      return [];
    }
  }

  async create(
    createData: CreateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    // return this.therapySessionModel.create(createData);
    const psychologist = await this.psychologistsService.getById(
      createData.psychologist,
    );
    const client = await this.usersService.getById(createData.client);

    return this.therapySessionModel.create({
      ...createData,
      client: psychologist._id,
      psychologist: client._id,
    });
  }

  async update(
    id: string,
    updateData: UpdateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    await this.therapySessionModel.findByIdAndUpdate(id, updateData);
    return this.therapySessionModel.findById(id);
  }

  async remove(id: string): Promise<TherapySessionDocument | null> {
    try {
      return await this.therapySessionModel.findByIdAndRemove(id);
    } catch {
      return null;
    }
  }
}
