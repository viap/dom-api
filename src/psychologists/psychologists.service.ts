import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { addItems } from 'src/common/utils/add-items.util';
import { removeItems } from 'src/common/utils/remove-item.util';
import { Role } from 'src/roles/roles.enum';
import { UsersService } from 'src/users/users.service';
import { CreateNewClientDto } from './dto/create-new-client.dto';
import { CreatePsychologistDto } from './dto/create-psychologist.dto';
import { UpdatePsychologistDto } from './dto/update-psychologist.dto';
import { Client } from './schemas/clients.schema';
import {
  Psychologist,
  PsychologistDocument,
} from './schemas/psychologist.schema';
import { EditMyClientDto } from './dto/edit-my-client.dto';

const submodels = [
  'user',
  {
    path: 'clients',
    populate: {
      path: 'user',
      model: 'User',
    },
  },
];

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

  async getById(
    id: string,
    populated = true,
  ): Promise<PsychologistDocument | null> {
    return this.psychologistModel
      .findById(id)
      .populate(populated ? submodels : undefined)
      .exec();
  }

  async getByUserId(userId: string): Promise<PsychologistDocument | null> {
    return this.psychologistModel
      .findOne({ user: userId })
      .populate(submodels)
      .exec();
  }

  async getClients(psychologistId: string): Promise<Array<Client>> {
    return (
      await this.psychologistModel.findById(psychologistId).populate({
        path: 'clients',
        populate: {
          path: 'user',
          model: 'User',
        },
      })
    ).clients;
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

  async addClientFromUser(
    psychologistId: string,
    userId: string,
  ): Promise<boolean> {
    const psychologist = await this.getById(psychologistId);
    const user = await this.userService.getById(userId);

    if (psychologist && user) {
      if (
        !psychologist.clients.find((client) => {
          return client.user === user._id.toString();
        })
      ) {
        psychologist.clients.push({
          user: user._id,
          descr: '',
        });
        await psychologist.save();
      }
      return true;
    } else {
      return false;
    }
  }

  async addNewClient(
    psychologistId: string,
    newClient: CreateNewClientDto,
  ): Promise<boolean> {
    const psychologist = await this.getById(psychologistId);
    if (psychologist) {
      const user = await this.userService.create({ name: newClient.name });
      psychologist.clients.push({
        user: user._id,
        descr: newClient.descr,
      });
      await psychologist.save();
      return true;
    } else {
      return false;
    }
  }

  async deleteClient(psychologistId: string, userId: string): Promise<boolean> {
    const psychologist = await this.getById(psychologistId);
    if (psychologist) {
      const result = await this.psychologistModel.updateMany(
        {},
        {
          $pull: {
            clients: {
              user: {
                $eq: new mongoose.Types.ObjectId(userId),
              },
            },
          },
        },
      );

      return result.modifiedCount > 0;
    } else {
      return false;
    }
  }

  async editPsychologistClient(
    psychologistId: string,
    userId: string,
    client: EditMyClientDto,
  ): Promise<boolean> {
    await this.psychologistModel.findByIdAndUpdate(
      psychologistId,
      {
        $set: {
          'clients.$[outer].descr': client.descr,
        },
      },
      {
        arrayFilters: [{ 'outer.user': new mongoose.Types.ObjectId(userId) }],
      },
    );

    return true;
  }

  async delete(id: string): Promise<boolean> {
    const psychologist = await this.getById(id);

    if (psychologist) {
      const user = await this.userService.getById(
        psychologist.user._id.toString(),
      );
      user.roles = removeItems<Role>(psychologist.user.roles, [
        Role.Psychologist,
      ]);
      await user.save();

      return !!(await this.psychologistModel.findByIdAndRemove(id));
    }

    return false;
  }
}
