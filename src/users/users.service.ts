import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from 'src/roles/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';
import { TelegramUserDto } from 'src/auth/dto/telegram.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getAll(): Promise<Array<User>> {
    return this.userModel.find().exec();
  }

  async getById(id: string): Promise<User> {
    return this.userModel.findById(id);
  }

  async getByTelegramId(telegramId: string): Promise<User> {
    return this.userModel.findOne({ telegramId }).exec();
  }

  async create(user: CreateUserDto): Promise<User> {
    return this.userModel.create(user);
  }

  async createFromTelegram(telegram: TelegramUserDto): Promise<User> {
    return this.userModel.create({
      telegramId: telegram.id,
      name: telegram.name,
      descr: telegram.descr,
      roles: [Role.User],
    });
  }

  async remove(id: string): Promise<User> {
    return this.userModel.findByIdAndRemove(id);
  }

  async update(id: string, user: UpdateUserDto): Promise<User> {
    return this.userModel.findByIdAndUpdate(id, user, { new: true });
  }
}
