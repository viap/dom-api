import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TelegramUserDto } from 'src/auth/dto/telegram.dto';
import {
  validateObjectId,
  validateRoles,
} from 'src/common/utils/mongo-sanitizer';
import { Role } from 'src/roles/enums/roles.enum';
import { SocialNetworks } from '../common/enums/social-networks.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getAll(): Promise<Array<UserDocument>> {
    return this.userModel.find().exec();
  }

  async getAllByRole(role: Role): Promise<Array<UserDocument>> {
    // Validate role enum to prevent injection
    const validRoles = validateRoles([role]);
    if (validRoles.length === 0) {
      return [];
    }
    return this.userModel.find({ roles: { $in: validRoles } }).exec();
  }

  async getById(id: string): Promise<UserDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }
    return this.userModel.findById(validId).exec();
  }

  async getByTelegramId(telegramId: string): Promise<UserDocument> {
    // Sanitize telegramId - ensure it's a string and reasonable length
    if (
      !telegramId ||
      typeof telegramId !== 'string' ||
      telegramId.length > 50
    ) {
      return null;
    }
    return await this.userModel
      .findOne({
        'contacts.id': telegramId,
        'contacts.network': SocialNetworks.Telegram,
      })
      .exec();
  }

  async getByTelegramUserName(telegramUserName: string): Promise<UserDocument> {
    // Sanitize username - ensure it's a string and reasonable length
    if (
      !telegramUserName ||
      typeof telegramUserName !== 'string' ||
      telegramUserName.length > 50
    ) {
      return null;
    }
    return await this.userModel
      .findOne({
        'contacts.username': telegramUserName,
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
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }

    // NOTICE: add notification about roles update - ?
    // const { roles = [] } = updateData;
    // const user = await this.userModel.findById(id).exec();

    // if (user && roles.length) {
    //   const addedRoles: Array<Role> = roles.filter((role) => {
    //     return !user.roles.includes(role) && Object.values(Role).includes(role);
    //   });

    //   const removedRoles: Array<Role> = user.roles.filter((role) => {
    //     return roles.length ? !roles.includes(role) : false;
    //   });

    //   // if(addedRoles.length){
    //   //   await this.notificationService.create({
    //   //     type: NotificationTypes.TRANSFER_THERAPY_REQUEST,
    //   //     roles: [Role.Psychologist],
    //   //     recipients: [psychologist.user._id.toString()],
    //   //   });
    //   // }
    // }

    await this.userModel.findByIdAndUpdate(validId, updateData, { new: true });
    return this.getById(validId);
  }

  async remove(id: string): Promise<UserDocument | null> {
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }
    return this.userModel.findByIdAndRemove(validId);
  }
}
