import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TherapyRequestsService } from './therapy-requests.service';
import { TherapyRequest } from './schemas/therapy-request.schema';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TherapyRequestClassifierService } from './therapy-request-classifier.service';
import {
  TherapyRequestCategory,
  TherapyRequestClientGender,
} from './enums/therapy-request-analytics.enum';

describe('RequestsService', () => {
  let service: TherapyRequestsService;
  let therapyRequestModel: {
    find: jest.Mock;
    findById: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };
  let psychologistsService: jest.Mocked<
    Pick<PsychologistsService, 'getById' | 'getByUserId'>
  >;
  let usersService: jest.Mocked<
    Pick<UsersService, 'getById' | 'create' | 'update'>
  >;
  let notificationsService: jest.Mocked<
    Pick<NotificationsService, 'create' | 'getAll' | 'getAllByUserId'>
  >;
  let classifierService: jest.Mocked<
    Pick<TherapyRequestClassifierService, 'classify'>
  >;

  beforeEach(async () => {
    therapyRequestModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    psychologistsService = {
      getById: jest.fn(),
      getByUserId: jest.fn(),
    };

    usersService = {
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    notificationsService = {
      create: jest.fn(),
      getAll: jest.fn(),
      getAllByUserId: jest.fn(),
    };

    classifierService = {
      classify: jest.fn().mockReturnValue({
        clientGender: 'unknown',
        requestCategory: 'unknown',
        topic: 'Needs support',
        analyticsReviewRequired: true,
        analyticsInference: {},
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TherapyRequestsService,
        {
          provide: getModelToken(TherapyRequest.name),
          useValue: therapyRequestModel,
        },
        {
          provide: PsychologistsService,
          useValue: psychologistsService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: TherapyRequestClassifierService,
          useValue: classifierService,
        },
      ],
    }).compile();

    service = module.get<TherapyRequestsService>(TherapyRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create resolves user by createData.user id', async () => {
    const createPayload = {
      name: 'John',
      descr: 'Needs support',
      user: '507f1f77bcf86cd799439011',
      psychologist: '507f1f77bcf86cd799439012',
      contacts: [{ network: 'telegram', username: '@john' }],
    };

    psychologistsService.getById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439012',
      user: { _id: '507f1f77bcf86cd799439099' },
    } as any);
    usersService.getById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
    } as any);

    const createdDoc = {
      psychologist: {
        user: { _id: { toString: () => '507f1f77bcf86cd799439099' } },
      },
      populate: jest.fn().mockResolvedValue({
        psychologist: {
          user: { _id: { toString: () => '507f1f77bcf86cd799439099' } },
        },
      }),
    };
    therapyRequestModel.create.mockResolvedValue(createdDoc);

    await service.create(createPayload as any);

    expect(usersService.getById).toHaveBeenCalledWith(createPayload.user);
    expect(usersService.getById).not.toHaveBeenCalledWith(
      createPayload.psychologist,
    );
  });

  it('create does not query user when createData.user is omitted', async () => {
    const createPayload = {
      name: 'John',
      descr: 'Needs support',
      psychologist: '507f1f77bcf86cd799439012',
      contacts: [{ network: 'telegram', username: '@john' }],
    };

    psychologistsService.getById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439012',
      user: { _id: '507f1f77bcf86cd799439099' },
    } as any);

    const createdDoc = {
      psychologist: {
        user: { _id: { toString: () => '507f1f77bcf86cd799439099' } },
      },
      populate: jest.fn().mockResolvedValue({
        psychologist: {
          user: { _id: { toString: () => '507f1f77bcf86cd799439099' } },
        },
      }),
    };
    therapyRequestModel.create.mockResolvedValue(createdDoc);

    await service.create(createPayload as any);

    expect(psychologistsService.getById).toHaveBeenCalledWith(
      createPayload.psychologist,
      false,
    );
    expect(usersService.getById).not.toHaveBeenCalled();
  });

  it('preserves automatic classification when create analytics fields are omitted', async () => {
    const createPayload = {
      name: 'John',
      descr: 'Женщина ищет индивидуальную терапию',
      contacts: [{ network: 'telegram', username: '@john' }],
    };
    classifierService.classify.mockReturnValueOnce({
      clientGender: TherapyRequestClientGender.Female,
      requestCategory: TherapyRequestCategory.Individual,
      topic: 'Женщина ищет индивидуальную терапию',
      analyticsReviewRequired: false,
      analyticsInference: {},
    });

    const createdDoc = {
      populate: jest.fn().mockResolvedValue({}),
    };
    therapyRequestModel.create.mockResolvedValue(createdDoc);

    await service.create(createPayload as any);

    expect(therapyRequestModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientGender: TherapyRequestClientGender.Female,
        requestCategory: TherapyRequestCategory.Individual,
        topic: 'Женщина ищет индивидуальную терапию',
        analyticsReviewRequired: false,
        analyticsInference: {},
      }),
    );
  });

  it('stores create-supplied gender/category as self-reported analytics requiring review', async () => {
    const createPayload = {
      name: 'John',
      descr: 'Нужна индивидуальная терапия из-за тревоги',
      contacts: [{ network: 'telegram', username: '@john' }],
      clientGender: TherapyRequestClientGender.Female,
      requestCategory: TherapyRequestCategory.Individual,
    };
    classifierService.classify.mockReturnValueOnce({
      clientGender: TherapyRequestClientGender.Unknown,
      requestCategory: TherapyRequestCategory.Unknown,
      topic: 'Нужна индивидуальная терапия из-за тревоги',
      analyticsReviewRequired: true,
      analyticsInference: {
        clientGender: {
          value: TherapyRequestClientGender.Unknown,
          confidence: 0.2,
          sources: ['name', 'descr'],
          reasons: ['No reliable persisted gender signal found'],
          manual: false,
        },
        requestCategory: {
          value: TherapyRequestCategory.Unknown,
          confidence: 0.2,
          sources: ['descr', 'name'],
          reasons: ['No reliable request category signal found'],
          manual: false,
        },
        topic: {
          value: 'Нужна индивидуальная терапия из-за тревоги',
          confidence: 0.68,
          sources: ['descr'],
          reasons: ['Used the first meaningful request text fragment as topic'],
          manual: false,
        },
      },
    });

    const createdDoc = {
      populate: jest.fn().mockResolvedValue({}),
    };
    therapyRequestModel.create.mockResolvedValue(createdDoc);

    await service.create(createPayload as any);

    expect(therapyRequestModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientGender: TherapyRequestClientGender.Female,
        requestCategory: TherapyRequestCategory.Individual,
        analyticsReviewRequired: true,
        analyticsInference: expect.objectContaining({
          clientGender: expect.objectContaining({
            value: TherapyRequestClientGender.Female,
            confidence: 1,
            sources: ['create_payload'],
            reasons: ['Self-reported during therapy request creation'],
            manual: false,
            selfReported: true,
            detectedAt: expect.any(Date),
          }),
          requestCategory: expect.objectContaining({
            value: TherapyRequestCategory.Individual,
            confidence: 1,
            sources: ['create_payload'],
            reasons: ['Self-reported during therapy request creation'],
            manual: false,
            selfReported: true,
            detectedAt: expect.any(Date),
          }),
        }),
      }),
    );

    const createArg = therapyRequestModel.create.mock.calls[0][0];
    expect(createArg.analyticsInference.clientGender.reviewedAt).toBeUndefined();
    expect(createArg.analyticsInference.clientGender.reviewedBy).toBeUndefined();
    expect(
      createArg.analyticsInference.requestCategory.reviewedAt,
    ).toBeUndefined();
    expect(
      createArg.analyticsInference.requestCategory.reviewedBy,
    ).toBeUndefined();
  });

  it('keeps create-supplied unknown analytics values review-required', async () => {
    const createPayload = {
      name: 'John',
      descr: 'Нужна индивидуальная терапия из-за тревоги',
      contacts: [{ network: 'telegram', username: '@john' }],
      clientGender: TherapyRequestClientGender.Unknown,
      requestCategory: TherapyRequestCategory.Individual,
    };
    classifierService.classify.mockReturnValueOnce({
      clientGender: TherapyRequestClientGender.Female,
      requestCategory: TherapyRequestCategory.Individual,
      topic: 'Нужна индивидуальная терапия из-за тревоги',
      analyticsReviewRequired: false,
      analyticsInference: {
        clientGender: {
          value: TherapyRequestClientGender.Female,
          confidence: 0.76,
          sources: ['name', 'descr'],
          reasons: ['Matched explicit client gender signal "женщина"'],
          manual: false,
        },
        requestCategory: {
          value: TherapyRequestCategory.Individual,
          confidence: 0.78,
          sources: ['descr', 'name'],
          reasons: ['Matched request category signal "тревог"'],
          manual: false,
        },
        topic: {
          value: 'Нужна индивидуальная терапия из-за тревоги',
          confidence: 0.68,
          sources: ['descr'],
          reasons: ['Used the first meaningful request text fragment as topic'],
          manual: false,
        },
      },
    });

    const createdDoc = {
      populate: jest.fn().mockResolvedValue({}),
    };
    therapyRequestModel.create.mockResolvedValue(createdDoc);

    await service.create(createPayload as any);

    expect(therapyRequestModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientGender: TherapyRequestClientGender.Unknown,
        requestCategory: TherapyRequestCategory.Individual,
        analyticsReviewRequired: true,
      }),
    );
  });

  it('keeps analytics review required on partial admin analytics edits', async () => {
    const therapyRequestId = '507f1f77bcf86cd799439011';
    const existingRequest = {
      _id: therapyRequestId,
      clientGender: 'unknown',
      requestCategory: 'unknown',
      topic: '',
      analyticsReviewRequired: true,
      analyticsInference: {
        requestCategory: {
          value: 'unknown',
          confidence: 0.2,
          sources: ['descr'],
          reasons: ['No reliable request category signal found'],
          manual: false,
        },
      },
    };

    therapyRequestModel.findById
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRequest),
      })
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRequest),
      });

    await service.updateAnalytics(
      therapyRequestId,
      { clientGender: 'female' as any },
      'admin-1',
    );

    expect(therapyRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
      therapyRequestId,
      expect.objectContaining({
        clientGender: 'female',
        analyticsReviewRequired: true,
      }),
      { new: true },
    );
  });

  it('honors explicit admin dismissal of analytics review', async () => {
    const therapyRequestId = '507f1f77bcf86cd799439011';
    const existingRequest = {
      _id: therapyRequestId,
      clientGender: 'female',
      requestCategory: 'individual',
      topic: 'Тревога',
      analyticsReviewRequired: true,
      analyticsInference: {},
    };

    therapyRequestModel.findById
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRequest),
      })
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingRequest),
      });

    await service.updateAnalytics(
      therapyRequestId,
      { analyticsReviewRequired: false },
      'admin-1',
    );

    expect(therapyRequestModel.findByIdAndUpdate).toHaveBeenCalledWith(
      therapyRequestId,
      expect.objectContaining({
        analyticsReviewRequired: false,
      }),
      { new: true },
    );
  });

  it('falls back to review-required analytics if classification fails on create', async () => {
    const createPayload = {
      name: 'John',
      descr: 'Needs support',
      contacts: [{ network: 'telegram', username: '@john' }],
    };
    classifierService.classify.mockImplementationOnce(() => {
      throw new Error('classifier failed');
    });

    const createdDoc = {
      populate: jest.fn().mockResolvedValue({}),
    };
    therapyRequestModel.create.mockResolvedValue(createdDoc);

    await service.create(createPayload as any);

    expect(therapyRequestModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientGender: 'unknown',
        requestCategory: 'unknown',
        topic: '',
        analyticsReviewRequired: true,
      }),
    );
  });
});
