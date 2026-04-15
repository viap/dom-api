import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PsychologistsService } from './psychologists.service';
import { Psychologist } from './schemas/psychologist.schema';
import { UsersService } from '../users/users.service';
import { SocialNetworks } from '../common/enums/social-networks.enum';

describe('PsychologistService', () => {
  let service: PsychologistsService;
  let mockUsersService: {
    getById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    getByTelegramUserName: jest.Mock;
  };

  beforeEach(async () => {
    const mockPsychologistModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    mockUsersService = {
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      getByTelegramUserName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PsychologistsService,
        {
          provide: getModelToken(Psychologist.name),
          useValue: mockPsychologistModel,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<PsychologistsService>(PsychologistsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('addNewClient should create a user when contacts are missing', async () => {
    const psychologist = {
      clients: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const createdUser = { _id: 'new-user-id' };
    jest.spyOn(service, 'getById').mockResolvedValue(psychologist as any);
    mockUsersService.getByTelegramUserName.mockResolvedValue(null);
    mockUsersService.create.mockResolvedValue(createdUser);

    const result = await service.addNewClient('psychologist-id', {
      name: 'No Contacts Client',
      descr: 'descr',
    });

    expect(result).toBe(true);
    expect(mockUsersService.getByTelegramUserName).not.toHaveBeenCalled();
    expect(mockUsersService.create).toHaveBeenCalledWith({
      name: 'No Contacts Client',
      contacts: undefined,
    });
    expect(psychologist.clients).toContainEqual({
      user: 'new-user-id',
      descr: 'descr',
      therapyRequest: undefined,
    });
    expect(psychologist.save).toHaveBeenCalled();
  });

  it('addNewClient should use existing user by telegram username when telegram contact is provided', async () => {
    const psychologist = {
      clients: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const existedUser = { _id: 'existing-user-id', descr: 'existing descr' };
    const contacts = [
      { network: SocialNetworks.Telegram, username: 'telegram_user' },
    ];
    jest.spyOn(service, 'getById').mockResolvedValue(psychologist as any);
    mockUsersService.getByTelegramUserName.mockResolvedValue(existedUser);

    const result = await service.addNewClient('psychologist-id', {
      name: 'Telegram Client',
      contacts: contacts as any,
    });

    expect(result).toBe(true);
    expect(mockUsersService.getByTelegramUserName).toHaveBeenCalledWith(
      'telegram_user',
    );
    expect(mockUsersService.create).not.toHaveBeenCalled();
    expect(psychologist.clients).toContainEqual({
      user: 'existing-user-id',
      descr: 'existing descr',
      therapyRequest: undefined,
    });
    expect(psychologist.save).toHaveBeenCalled();
  });

  it('addNewClient should create a user when contacts is an empty array', async () => {
    const psychologist = {
      clients: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const createdUser = { _id: 'empty-contacts-user-id' };
    jest.spyOn(service, 'getById').mockResolvedValue(psychologist as any);
    mockUsersService.getByTelegramUserName.mockResolvedValue(null);
    mockUsersService.create.mockResolvedValue(createdUser);

    const result = await service.addNewClient('psychologist-id', {
      name: 'Empty Contacts Client',
      contacts: [],
    });

    expect(result).toBe(true);
    expect(mockUsersService.getByTelegramUserName).not.toHaveBeenCalled();
    expect(mockUsersService.create).toHaveBeenCalledWith({
      name: 'Empty Contacts Client',
      contacts: undefined,
    });
    expect(psychologist.clients).toContainEqual({
      user: 'empty-contacts-user-id',
      descr: '',
      therapyRequest: undefined,
    });
    expect(psychologist.save).toHaveBeenCalled();
  });
});
