import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { TelegramUserDto } from 'src/auth/dto/telegram.dto';
import {
  sanitizeObject,
  validateObjectId,
  validateRoles,
} from 'src/common/utils/mongo-sanitizer';
import { Role } from 'src/roles/enums/roles.enum';
import { AuthUserDto } from '../auth/dto/auth-user.dto';
import { SocialNetworks } from '../common/enums/social-networks.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  private readonly saltRounds = 12;

  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  private async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

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
    const sanitizedTelegramId = sanitizeObject(telegramId);
    if (
      !sanitizedTelegramId ||
      typeof sanitizedTelegramId !== 'string' ||
      sanitizedTelegramId.length > 50
    ) {
      return null;
    }
    return await this.userModel
      .findOne({
        'contacts.id': sanitizedTelegramId,
        'contacts.network': SocialNetworks.Telegram,
      })
      .exec();
  }

  async getByAuthUser(authUser: AuthUserDto): Promise<UserDocument> {
    const sanitizedAuthUser = sanitizeObject(authUser) as AuthUserDto;

    const user = await this.userModel
      .findOne({
        login: sanitizedAuthUser.login,
      })
      .exec();

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await this.comparePassword(
      sanitizedAuthUser.password,
      user.password,
    );

    return isPasswordValid ? user : null;
  }

  async getByTelegramUserName(telegramUserName: string): Promise<UserDocument> {
    const sanitizedTelegramUserName = sanitizeObject(telegramUserName);
    if (
      !sanitizedTelegramUserName ||
      typeof sanitizedTelegramUserName !== 'string' ||
      sanitizedTelegramUserName.length > 50
    ) {
      return null;
    }
    return await this.userModel
      .findOne({
        'contacts.username': sanitizedTelegramUserName,
        'contacts.network': SocialNetworks.Telegram,
      })
      .exec();
  }

  async create(createData: CreateUserDto): Promise<UserDocument> {
    const userData = { ...createData };

    if (userData.password) {
      userData.password = await this.hashPassword(userData.password);
    }

    return this.userModel.create(userData);
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

    const userData = { ...updateData };

    if (userData.password) {
      userData.password = await this.hashPassword(userData.password);
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

    await this.userModel.findByIdAndUpdate(validId, userData, { new: true });
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
