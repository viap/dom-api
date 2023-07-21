import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from 'src/roles/roles.enum';
import { UsersService } from 'src/users/users.service';
import { CreatePsychologistDto } from './dto/create-psychologist.dto';
import { UpdatePsychologistDto } from './dto/update-psychologist.dto';
import { Psychologist } from './schemas/psychologist.schema';

@Injectable()
export class PsychologistsService {
  constructor(
    @InjectModel(Psychologist.name)
    private psychologistModel: Model<Psychologist>,
    private userService: UsersService,
  ) {}

  async getAll(): Promise<Array<Psychologist>> {
    return this.psychologistModel.find().exec();
  }

  async getById(id: string): Promise<Psychologist> {
    return this.psychologistModel.findById(id);
  }

  async findByUserId(id: string): Promise<Psychologist> {
    return this.psychologistModel.findOne({ user: id }).exec();
  }

  async create(createData: CreatePsychologistDto): Promise<Psychologist> {
    try {
      const psychologist = await this.findByUserId(createData.user);

      if (psychologist) {
        return psychologist;
      }

      await this.userService.addRoles(createData.user, [Role.Psychologist]);
      return this.psychologistModel.create({ user: createData.user });
    } catch {
      throw new Error('User is not found');
    }
  }

  async update(
    id: string,
    updateData: UpdatePsychologistDto,
  ): Promise<Psychologist> {
    await this.psychologistModel.findByIdAndUpdate(id, updateData);
    return this.psychologistModel.findById(id);
  }

  async remove(id: string): Promise<Psychologist> {
    const psychologist = await this.psychologistModel.findByIdAndRemove(id);

    await this.userService.removeRoles(psychologist.user.toString(), [
      Role.Psychologist,
    ]);
    return psychologist;
  }
}
