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

      // find user by id and add new role of psychologist
      const user = await this.userService.getById(createData.user);
      if (!user.roles.includes(Role.Psychologist)) {
        user.roles.push(Role.Psychologist);
      }
      await this.userService.update(createData.user, user);

      return this.psychologistModel.create({ user: createData.user });
    } catch {
      throw new Error('User is not found');
    }
  }

  async update(
    id: string,
    updateData: UpdatePsychologistDto,
  ): Promise<Psychologist> {
    return this.psychologistModel.findByIdAndUpdate(id, updateData);
  }

  async remove(id: string): Promise<Psychologist> {
    const psychologist = await this.psychologistModel.findByIdAndRemove(id);

    const userId = psychologist.user.toString();
    const user = await this.userService.getById(userId);
    const ind = user.roles.findIndex(
      (role: string) => role === Role.Psychologist,
    );
    user.roles.splice(ind, 1);
    await this.userService.update(userId, user);

    return psychologist;
  }
}
