import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SocialNetworks } from 'src/common/enums/social-networks.enum';
import { Contact } from 'src/common/schemas/contact.schema';
import { valueToObjectId } from 'src/common/utils/value-to-object-id';
import { NotificationTypes } from 'src/notifications/enums/notification-types.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PsychologistsService } from 'src/psychologists/psychologists.service';
import { PsychologistDocument } from 'src/psychologists/schemas/psychologist.schema';
import { Role } from 'src/roles/enums/roles.enum';
import { UserDocument } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { CreateTherapyRequestDto } from './dto/create-therapy-request.dto';
import { UpdateTherapyRequestDto } from './dto/update-therapy-request.dto';
import {
  TherapyRequest,
  TherapyRequestDocument,
} from './schemas/therapy-request.schema';

const submodels = [
  'user',
  'psychologist',
  {
    path: 'psychologist',
    populate: {
      path: 'user',
      model: 'User',
    },
  },
];

@Injectable()
export class TherapyRequestsService {
  constructor(
    @InjectModel(TherapyRequest.name)
    private therapyRequestModel: Model<TherapyRequest>,
    private psychologistService: PsychologistsService,
    private userService: UsersService,
    private notificationService: NotificationsService,
  ) {}

  async getAll(params?: {
    [key: string]: any;
  }): Promise<Array<TherapyRequestDocument>> {
    return this.therapyRequestModel.find(params).populate(submodels).exec();
  }

  async getAllForPsychologist(
    psychologistId: string,
    params?: {
      [key: string]: any;
    },
  ): Promise<Array<TherapyRequestDocument>> {
    try {
      return await this.therapyRequestModel
        .find({ psychologist: psychologistId, ...params })
        .populate(submodels)
        .exec();
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<TherapyRequestDocument> {
    return this.therapyRequestModel.findById(id).populate(submodels).exec();
  }

  async create(
    createData: CreateTherapyRequestDto,
  ): Promise<TherapyRequestDocument> {
    let psychologist: PsychologistDocument | undefined = undefined;
    if (createData.psychologist) {
      psychologist = await this.psychologistService.getById(
        createData.psychologist,
        false,
      );
    }

    let user: UserDocument | undefined = undefined;
    if (createData.user) {
      user = await this.userService.getById(createData.psychologist);
    }

    const therapyRequest = await (
      await this.therapyRequestModel.create({
        ...createData,
        psychologist: psychologist
          ? psychologist._id
          : createData.psychologist
          ? valueToObjectId(createData.psychologist)
          : undefined,
        user: user
          ? user._id
          : createData.user
          ? valueToObjectId(createData.user)
          : undefined,
      })
    ).populate(submodels);

    this.notificationService.create({
      type: NotificationTypes.NEW_THERAPY_REQUEST,
      roles: [Role.Psychologist],
      recipients:
        therapyRequest.psychologist && therapyRequest.psychologist.user
          ? [therapyRequest.psychologist.user._id.toString()]
          : undefined,
    });

    return therapyRequest;
  }

  async acceptRequest(therapyRequestId: string): Promise<boolean> {
    const therapyRequest = await this.getById(therapyRequestId);
    let result: boolean | undefined = false;

    if (
      therapyRequest &&
      therapyRequest.psychologist &&
      !therapyRequest.accepted
    ) {
      const telegramUserFromRequest: Contact | undefined =
        therapyRequest.contacts.find(
          (contact) => contact.network === SocialNetworks.Telegram,
        );

      const telegramUserFromUser: Contact | undefined =
        therapyRequest.user?.contacts.find(
          (contact) => contact.network === SocialNetworks.Telegram,
        );

      if (
        therapyRequest.user &&
        telegramUserFromUser?.username === telegramUserFromRequest?.username
      ) {
        result = await this.psychologistService.addClientFromUser(
          therapyRequest.psychologist._id.toString(),
          therapyRequest.user._id.toString(),
          therapyRequest,
        );
      } else {
        result = await this.psychologistService.addNewClient(
          therapyRequest.psychologist._id.toString(),
          {
            name: therapyRequest.name,
            descr: therapyRequest.descr,
            contacts: therapyRequest.contacts,
          },
          therapyRequest,
        );
      }

      if (result) {
        therapyRequest.accepted = true;
        await therapyRequest.save();
      }
    }

    return result;
  }

  async rejectRequest(therapyRequestId: string): Promise<boolean> {
    const therapyRequest = await this.getById(therapyRequestId);

    if (therapyRequest && !therapyRequest.accepted) {
      therapyRequest.psychologist = undefined;
      await therapyRequest.save();

      return !therapyRequest.psychologist;
    }

    return false;
  }

  async update(
    id: string,
    updateData: UpdateTherapyRequestDto,
  ): Promise<TherapyRequestDocument> {
    await this.therapyRequestModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    return this.getById(id);
  }

  async remove(id: string): Promise<boolean> {
    return !!(await this.therapyRequestModel.findByIdAndRemove(id));
  }
}
