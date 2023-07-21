import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from 'src/users/users.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Participant } from './schema/participant.schema';

@Injectable()
export class ParticipantsService {
  constructor(
    @InjectModel(Participant.name) private participantModel: Model<Participant>,
    private userService: UsersService,
  ) {}

  async getAll(): Promise<Array<Participant>> {
    return this.participantModel.find().exec();
  }

  async getById(id: string): Promise<Participant> {
    return this.participantModel.findById(id);
  }

  async getByUserId(userId: string): Promise<Participant> {
    return this.participantModel.findOne({ user: userId });
  }

  async create(createData: CreateParticipantDto): Promise<Participant> {
    const user = createData.user
      ? await this.userService.getById(createData.user)
      : undefined;

    let participant;
    if (user) {
      try {
        participant = await this.getByUserId(createData.user);
      } catch {}
    }

    if (participant) {
      return participant;
    } else {
      return this.participantModel.create(createData);
    }
  }

  async update(
    id: string,
    updateData: UpdateParticipantDto,
  ): Promise<Participant> {
    await this.participantModel.findByIdAndUpdate(id, updateData);
    return this.participantModel.findById(id);
  }

  async remove(id: string): Promise<Participant | null> {
    return this.participantModel.findByIdAndRemove(id);
  }
}
