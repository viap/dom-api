import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TelegramUserDto } from 'src/auth/dto/telegram.dto';
import { Role } from 'src/roles/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const defaultPopulate = ['psychologist'];

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getAll(): Promise<Array<UserDocument>> {
    return this.userModel.find().populate(defaultPopulate).exec();
  }

  async getAllByRole(role: Role): Promise<Array<UserDocument>> {
    return this.userModel
      .find({ roles: { $in: [role] } }, {}, { populate: defaultPopulate })
      .exec();
  }

  async getById(id: string): Promise<UserDocument> {
    return this.userModel.findById(id);
  }

  async getByTelegramId(telegramId: string): Promise<UserDocument> {
    return this.userModel.findOne({ telegramId }).exec();
  }

  async getByPsychologistId(psychologistId: string): Promise<UserDocument> {
    return this.userModel
      .findOne(
        { psychologist: psychologistId },
        {},
        { populate: defaultPopulate },
      )
      .exec();
  }

  async create(user: CreateUserDto): Promise<UserDocument> {
    return this.userModel.create(user);
  }

  async createFromTelegram(telegram: TelegramUserDto): Promise<UserDocument> {
    return this.userModel.create({
      telegramId: telegram.id,
      name: telegram.name,
      descr: telegram.descr,
      roles: [Role.User],
    });
  }

  async update(id: string, user: UpdateUserDto): Promise<UserDocument> {
    await this.userModel.findByIdAndUpdate(id, user, { new: true });
    return this.userModel.findById(id);
  }

  async bindWithPsychologist(
    id: string,
    psychologist: string,
  ): Promise<UserDocument> {
    return this.userModel.findByIdAndUpdate(id, { psychologist });
  }

  async remove(id: string): Promise<UserDocument> {
    return this.userModel.findByIdAndRemove(id);
  }
}
