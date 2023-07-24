import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from 'src/roles/roles.enum';
import { UserDocument } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { addItems } from 'src/utils/add-items.util';
import { removeItems } from 'src/utils/remove-item.util';
import { CreatePsychologistDto } from './dto/create-psychologist.dto';
import { UpdatePsychologistDto } from './dto/update-psychologist.dto';
import {
  Psychologist,
  PsychologistDocument,
} from './schemas/psychologist.schema';

@Injectable()
export class PsychologistsService {
  constructor(
    @InjectModel(Psychologist.name)
    private psychologistModel: Model<Psychologist>,
    private userService: UsersService,
  ) {}

  async getAll(): Promise<Array<UserDocument>> {
    return this.userService.getAllByRole(Role.Psychologist);
  }

  async getById(id: string): Promise<UserDocument> {
    return this.userService.getByPsychologistId(id);
  }

  async create(createData: CreatePsychologistDto): Promise<UserDocument> {
    const user = await this.userService.getById(createData.userId);

    if (!user) {
      throw new Error('User is not found');
    }

    if (user.psychologist) {
      return user;
    }

    const psychologist = await this.psychologistModel.create({});
    this.userService.bindWithPsychologist(
      createData.userId,
      psychologist._id.toString(),
    );

    user.roles = addItems<Role>(user.roles, [Role.Psychologist]);
    await user.save();

    return user;
  }

  async update(
    id: string,
    updateData: UpdatePsychologistDto,
  ): Promise<PsychologistDocument> {
    await this.psychologistModel.findByIdAndUpdate(id, updateData);
    return this.psychologistModel.findById(id);
  }

  async remove(id: string): Promise<PsychologistDocument> {
    const psychologist = await this.psychologistModel.findByIdAndRemove(id);

    if (psychologist) {
      const user = await this.userService.getByPsychologistId(
        psychologist._id.toString(),
      );
      user.psychologist = undefined;
      user.roles = removeItems<Role>(user.roles, [Role.Psychologist]);
      await user.save();
    }

    return psychologist;
  }
}
