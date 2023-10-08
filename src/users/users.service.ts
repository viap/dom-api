import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TelegramUserDto } from 'src/auth/dto/telegram.dto';
import { Role } from 'src/roles/enums/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SocialNetworks } from '../common/enums/social-networks.enum';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getAll(): Promise<Array<UserDocument>> {
    return this.userModel.find().exec();
  }

  async getAllByRole(role: Role): Promise<Array<UserDocument>> {
    return this.userModel.find({ roles: { $in: [role] } }).exec();
  }

  async getById(id: string): Promise<UserDocument> {
    return this.userModel.findById(id).exec();
  }

  async getByTelegramId(telegramId: string): Promise<UserDocument> {
    return await this.userModel
      .findOne({
        'contacts.id': telegramId,
        'contacts.network': SocialNetworks.Telegram,
      })
      .exec();
  }

  async create(createData: CreateUserDto): Promise<UserDocument> {
    return this.userModel.create(createData);
  }

  async createFromTelegram(telegram: TelegramUserDto): Promise<UserDocument> {
    const name = [telegram.last_name, telegram.first_name]
      .filter((value) => !!value)
      .join(' ');

    return this.userModel.create({
      name: name || telegram.username,
      roles: [Role.User],
      contacts: [
        {
          network: SocialNetworks.Telegram,
          id: telegram.id,
          username: telegram.username,
        },
      ],
    });
  }

  async update(id: string, updateData: UpdateUserDto): Promise<UserDocument> {
    await this.userModel.findByIdAndUpdate(id, updateData, { new: true });
    return this.getById(id);
  }

  async remove(id: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndRemove(id);
  }
}
