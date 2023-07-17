import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';

import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

const mockUser = {
  name: 'User #1',
  descr: 'Breed #1',
  img: '',
};

describe('UsersService', () => {
  let service: UsersService;
  let model: Model<User>;

  const usersArray = [
    {
      name: 'User #1',
      descr: 'Breed #1',
      img: '',
    },
    {
      name: 'User #2',
      descr: 'Breed #2',
      img: '',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken('User'),
          useValue: {
            new: jest.fn().mockResolvedValue(mockUser),
            constructor: jest.fn().mockResolvedValue(mockUser),
            find: jest.fn(),
            create: jest.fn(),
            exec: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    model = module.get<Model<User>>(getModelToken('User'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all users', async () => {
    jest.spyOn(model, 'find').mockReturnValue({
      exec: jest.fn().mockResolvedValueOnce(usersArray),
    } as any);
    const users = await service.getAll();
    expect(users).toEqual(usersArray);
  });

  it('should insert a new user', async () => {
    jest.spyOn(model, 'create').mockImplementationOnce(() =>
      Promise.resolve({
        name: 'User #1',
        descr: 'Breed #1',
        img: '',
      } as any),
    );
    const newUser = await service.create({
      name: 'User #1',
      descr: 'Breed #1',
      img: '',
    });
    expect(newUser).toEqual(mockUser);
  });
});
