import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SocialNetworks } from '@/common/enums/social-networks.enum';
import { Contact } from '@/common/schemas/contact.schema';
import { TherapyRequestFilters } from '@/common/types/therapy-request-params.types';
import {
  safeFindParams,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { valueToObjectId } from '@/common/utils/value-to-object-id';
import { NotificationTypes } from '@/notifications/enums/notification-types.enum';
import { NotificationsService } from '@/notifications/notifications.service';
import { PsychologistsService } from '@/psychologists/psychologists.service';
import { PsychologistDocument } from '@/psychologists/schemas/psychologist.schema';
import { Role } from '@/roles/enums/roles.enum';
import { UserDocument } from '@/users/schemas/user.schema';
import { UsersService } from '@/users/users.service';
import { CreateTherapyRequestDto } from './dto/create-therapy-request.dto';
import { UpdateTherapyRequestAnalyticsDto } from './dto/update-therapy-request-analytics.dto';
import { UpdateTherapyRequestDto } from './dto/update-therapy-request.dto';
import {
  TherapyRequestCategory,
  TherapyRequestAnalyticsField,
  TherapyRequestClientGender,
  therapyRequestAnalyticsFields,
} from './enums/therapy-request-analytics.enum';
import {
  TherapyRequest,
  TherapyRequestDocument,
} from './schemas/therapy-request.schema';
import {
  computeTherapyRequestAnalyticsReviewRequired,
  TherapyRequestClassification,
} from './therapy-request-classifier.core';
import { TherapyRequestClassifierService } from './therapy-request-classifier.service';
import {
  AnalyticsFieldInferenceValue,
  TherapyRequestAnalyticsInference,
} from './types/therapy-request-analytics.types';

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
    private therapyRequestModel: Model<TherapyRequestDocument>,
    private psychologistService: PsychologistsService,
    private userService: UsersService,
    private notificationService: NotificationsService,
    private classifierService: TherapyRequestClassifierService,
  ) {}

  private classifySafely(
    input: Parameters<TherapyRequestClassifierService['classify']>[0],
    current?: TherapyRequestDocument,
  ): Partial<TherapyRequestClassification> {
    try {
      return this.classifierService.classify(input);
    } catch {
      return {
        clientGender:
          current?.clientGender || TherapyRequestClientGender.Unknown,
        requestCategory:
          current?.requestCategory || TherapyRequestCategory.Unknown,
        analyticsInference: current?.analyticsInference || {},
        analyticsReviewRequired: true,
      };
    }
  }

  private createPayloadInference(
    value: TherapyRequestCategory | TherapyRequestClientGender,
    now: Date,
  ): AnalyticsFieldInferenceValue {
    return {
      value,
      confidence: 1,
      sources: ['create_payload'],
      reasons: ['Self-reported during therapy request creation'],
      detectedAt: now,
      manual: false,
      selfReported: true,
    };
  }

  private mergeCreateAnalyticsOverrides(
    classification: Partial<TherapyRequestClassification>,
    createData: CreateTherapyRequestDto,
  ): Partial<TherapyRequestClassification> {
    if (!createData.clientGender && !createData.requestCategory) {
      return classification;
    }

    const now = new Date();
    const analyticsInference: TherapyRequestAnalyticsInference = {
      ...(classification.analyticsInference || {}),
    };
    const analyticsPatch: Partial<TherapyRequestClassification> = {
      ...classification,
      analyticsInference,
    };

    if (createData.clientGender) {
      analyticsPatch.clientGender = createData.clientGender;
      analyticsInference.clientGender = this.createPayloadInference(
        createData.clientGender,
        now,
      );
    }

    if (createData.requestCategory) {
      analyticsPatch.requestCategory = createData.requestCategory;
      analyticsInference.requestCategory = this.createPayloadInference(
        createData.requestCategory,
        now,
      );
    }

    analyticsPatch.analyticsReviewRequired =
      computeTherapyRequestAnalyticsReviewRequired(
        {
          clientGender: analyticsPatch.clientGender,
          requestCategory: analyticsPatch.requestCategory,
        },
        analyticsInference,
      );

    return analyticsPatch;
  }

  async getAll(
    params?: TherapyRequestFilters,
  ): Promise<Array<TherapyRequestDocument>> {
    const safeParams = safeFindParams(params);
    return this.therapyRequestModel.find(safeParams).populate(submodels).exec();
  }

  async getAllForPsychologist(
    psychologistId: string,
    params?: TherapyRequestFilters,
  ): Promise<Array<TherapyRequestDocument>> {
    try {
      const validId = validateObjectId(psychologistId);
      if (!validId) {
        return [];
      }
      const safeParams = safeFindParams(params);
      return await this.therapyRequestModel
        .find({ psychologist: validId, ...safeParams })
        .populate(submodels)
        .exec();
    } catch {
      return [];
    }
  }

  async getById(id: string): Promise<TherapyRequestDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }
    return this.therapyRequestModel
      .findById(validId)
      .populate(submodels)
      .exec();
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
      user = await this.userService.getById(createData.user);
    }

    const therapyRequest = await (
      await this.therapyRequestModel.create({
        ...createData,
        ...this.mergeCreateAnalyticsOverrides(
          this.classifySafely({
            ...createData,
            user,
          }),
          createData,
        ),
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

    const hasPsychologist =
      therapyRequest.psychologist && therapyRequest.psychologist.user;

    this.notificationService.create({
      type: NotificationTypes.NEW_THERAPY_REQUEST,
      roles: hasPsychologist ? [Role.Psychologist] : [Role.Admin],
      recipients: hasPsychologist
        ? [therapyRequest.psychologist.user._id.toString()]
        : undefined,
    });

    return therapyRequest;
  }

  async update(
    id: string,
    updateData: UpdateTherapyRequestDto,
  ): Promise<TherapyRequestDocument> {
    const existingRequest = await this.getById(id);
    const shouldReclassify =
      !!existingRequest &&
      ['name', 'descr', 'user', 'contacts'].some((field) =>
        Object.prototype.hasOwnProperty.call(updateData, field),
      );

    const user =
      updateData.user &&
      updateData.user !== existingRequest?.user?._id?.toString()
        ? await this.userService.getById(updateData.user)
        : existingRequest?.user;

    const analyticsPatch = shouldReclassify
      ? this.classifySafely(
          {
            name: updateData.name ?? existingRequest.name,
            descr: updateData.descr ?? existingRequest.descr,
            user,
            contacts: updateData.contacts ?? existingRequest.contacts,
            current: existingRequest,
          },
          existingRequest,
        )
      : {};

    await this.therapyRequestModel.findByIdAndUpdate(
      id,
      { ...updateData, ...analyticsPatch },
      {
        new: true,
      },
    );

    if (updateData.psychologist) {
      const psychologist = await this.psychologistService.getById(
        updateData.psychologist,
      );

      if (psychologist) {
        await this.notificationService.create({
          type: NotificationTypes.TRANSFER_THERAPY_REQUEST,
          roles: [Role.Psychologist],
          recipients: [psychologist.user._id.toString()],
        });
      }
    }

    return this.getById(id);
  }

  async updateAnalytics(
    id: string,
    updateData: UpdateTherapyRequestAnalyticsDto,
    reviewedBy?: string,
  ): Promise<TherapyRequestDocument> {
    const therapyRequest = await this.getById(id);
    if (!therapyRequest) {
      return null;
    }

    const now = new Date();
    const analyticsInference = {
      ...(therapyRequest.analyticsInference || {}),
    };

    for (const field of therapyRequestAnalyticsFields) {
      if (!Object.prototype.hasOwnProperty.call(updateData, field)) {
        continue;
      }

      const value = updateData[field as TherapyRequestAnalyticsField] as
        | string
        | boolean
        | undefined;

      if (typeof value !== 'string') {
        continue;
      }

      analyticsInference[field] = {
        value,
        confidence: 1,
        sources: ['admin'],
        reasons: ['Manually reviewed in admin analytics'],
        detectedAt: analyticsInference[field]?.detectedAt || now,
        reviewedAt: now,
        reviewedBy,
        manual: true,
      };
    }

    const mergedValues = {
      clientGender: updateData.clientGender ?? therapyRequest.clientGender,
      requestCategory:
        updateData.requestCategory ?? therapyRequest.requestCategory,
    };
    const analyticsReviewRequired =
      typeof updateData.analyticsReviewRequired === 'boolean'
        ? updateData.analyticsReviewRequired
        : computeTherapyRequestAnalyticsReviewRequired(
            mergedValues,
            analyticsInference,
          );

    const patch = {
      ...updateData,
      analyticsInference,
      analyticsReviewRequired,
    };

    await this.therapyRequestModel.findByIdAndUpdate(id, patch, {
      new: true,
    });

    return this.getById(id);
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

  async remove(id: string): Promise<boolean> {
    return !!(await this.therapyRequestModel.findByIdAndRemove(id));
  }
}
