import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TherapyRequestsService } from './therapy-requests.service';
import { TherapyRequest } from './schemas/therapy-request.schema';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

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
  let usersService: jest.Mocked<Pick<UsersService, 'getById' | 'create' | 'update'>>;
  let notificationsService: jest.Mocked<
    Pick<NotificationsService, 'create' | 'getAll' | 'getAllByUserId'>
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
});
