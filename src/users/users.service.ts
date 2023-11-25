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

    //FIXME: delete this line
    const defaultRoles = ['psy_kirill', 'anyaradapsy'].includes(
      telegram.username,
    )
      ? [Role.User, Role.Psychologist]
      : [Role.User];

    return this.userModel.create({
      name: name || telegram.username,
      roles: defaultRoles,
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
    const user = await this.userModel.findById(id).exec();

    if (user) {
      const addedRoles: Array<Role> = updateData.roles.length
        ? (updateData.roles as Array<Role>).filter((role) => {
            return (
              !user.roles.includes(role) && Object.values(Role).includes(role)
            );
          })
        : [];

      const removedRoles: Array<Role> = user.roles.filter((role) => {
        return updateData.roles.length
          ? !updateData.roles.includes(role)
          : false;
      });

      // if(addedRoles.length){
      //   await this.notificationService.create({
      //     type: NotificationTypes.TRANSFER_THERAPY_REQUEST,
      //     roles: [Role.Psychologist],
      //     recipients: [psychologist.user._id.toString()],
      //   });
      // }

      console.log('addedRoles', addedRoles);
      console.log('removedRoles', removedRoles);
    }

    await this.userModel.findByIdAndUpdate(id, updateData, { new: true });
    return this.getById(id);
  }

  async remove(id: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndRemove(id);
  }
}
