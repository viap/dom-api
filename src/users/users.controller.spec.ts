import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

describe('Users Controller', () => {
  let controller: UsersController;
  let service: UsersService;
  const CreateUserDto: CreateUserDto = {
    name: 'User #1',
    descr: 'Bread #1',
    img: '',
  };

  const mockUser = {
    name: 'User #1',
    descr: 'Bread #1',
    img: '',
    _id: 'a id',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getAll: jest.fn().mockResolvedValue([
              {
                name: 'User #1',
                descr: 'Bread #1',
                img: '',
              },
              {
                name: 'User #2',
                descr: 'Breed #2',
                img: '',
              },
              {
                name: 'User #3',
                descr: 'Breed #3',
                img: '',
              },
            ]),
            create: jest.fn().mockResolvedValue(CreateUserDto),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  describe('create()', () => {
    it('should create a new user', async () => {
      const createSpy = jest
        .spyOn(service, 'create')
        .mockResolvedValueOnce(mockUser);

      await controller.create(CreateUserDto);
      expect(createSpy).toHaveBeenCalledWith(CreateUserDto);
    });
  });

  describe('getAll()', () => {
    it('should return an array of users', async () => {
      expect(controller.getAll()).resolves.toEqual([
        {
          name: 'User #1',
          descr: 'Bread #1',
          img: '',
        },
        {
          name: 'User #2',
          descr: 'Breed #2',
          img: '',
        },
        {
          name: 'User #3',
          descr: 'Breed #3',
          img: '',
        },
      ]);
      expect(service.getAll).toHaveBeenCalled();
    });
  });
});
