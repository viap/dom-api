import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { addItems } from 'src/common/utils/add-items.util';
import { removeItems } from 'src/common/utils/remove-item.util';
import { Role } from 'src/roles/roles.enum';
import { UsersService } from 'src/users/users.service';
import { CreatePsychologistDto } from './dto/create-psychologist.dto';
import { UpdatePsychologistDto } from './dto/update-psychologist.dto';
import {
  Psychologist,
  PsychologistDocument,
} from './schemas/psychologist.schema';

const submodels = ['user'];

@Injectable()
export class PsychologistsService {
  constructor(
    @InjectModel(Psychologist.name)
    private psychologistModel: Model<Psychologist>,
    private userService: UsersService,
  ) {}

  async getAll(): Promise<Array<PsychologistDocument>> {
    return this.psychologistModel.find().populate(submodels).exec();
  }

  async getById(id: string): Promise<PsychologistDocument | null> {
    return this.psychologistModel.findById(id).populate(submodels).exec();
  }

  async create(
    createData: CreatePsychologistDto,
  ): Promise<PsychologistDocument> {
    const psychologist = await this.psychologistModel
      .findOne({ user: createData.userId })
      .populate(submodels)
      .exec();

    if (psychologist) {
      return psychologist;
    }

    const user = await this.userService.getById(createData.userId);

    if (!user) {
      throw new Error('User is not found');
    }

    const newPsychologist = await this.psychologistModel.create({
      user: user._id,
    });

    user.roles = addItems<Role>(user.roles, [Role.Psychologist]);
    await user.save();

    return newPsychologist.populate(submodels);
  }

  async update(
    id: string,
    updateData: UpdatePsychologistDto,
  ): Promise<PsychologistDocument> {
    await this.psychologistModel.findByIdAndUpdate(id, updateData);
    return this.getById(id);
  }

  async addClient(psychologistId: string, clientId: string): Promise<boolean> {
    const psychologist = await this.getById(psychologistId);
    const client = await this.userService.getById(clientId);

    if (psychologist) {
      const clients = psychologist.clients || [];
      if (!clients.includes(client._id.toString())) {
        clients.push(client._id);
        psychologist.clients = clients;
        psychologist.save();
      }

      return true;
    } else {
      return false;
    }
  }

  async remove(id: string): Promise<PsychologistDocument | null> {
    const psychologist = await this.getById(id);

    if (psychologist) {
      const user = await this.userService.getById(
        psychologist.user._id.toString(),
      );
      user.roles = removeItems<Role>(psychologist.user.roles, [
        Role.Psychologist,
      ]);
      await user.save();

      await this.psychologistModel.findByIdAndRemove(id);
    }

    return psychologist;
  }
}
