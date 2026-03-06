import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../roles/enums/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserDocument } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('Users Controller', () => {
  let controller: UsersController;
  let service: UsersService;

  const createUserDto: CreateUserDto = {
    name: 'User #1',
    descr: 'Test user description',
  };

  const updateUserDto: UpdateUserDto = {
    name: 'Updated User',
    descr: 'Updated description',
  };

  const mockUserDocument = {
    _id: '507f1f77bcf86cd799439011',
    name: 'User #1',
    login: 'user1@test.com',
    descr: 'Test user description',
    roles: [Role.User],
    contacts: [],
    toObject: jest.fn().mockReturnThis(),
  } as unknown as UserDocument;

  const mockUpdatedUserDocument = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Updated User',
    login: 'user1@test.com',
    descr: 'Updated description',
    roles: [Role.User],
    contacts: [],
    toObject: jest.fn().mockReturnThis(),
  } as unknown as UserDocument;

  const mockAllUsersDocuments = [
    {
      _id: '507f1f77bcf86cd799439011',
      name: 'User #1',
      login: 'user1@test.com',
      descr: 'Test user 1',
      roles: [Role.User],
      contacts: [],
      toObject: jest.fn().mockReturnThis(),
    },
    {
      _id: '507f1f77bcf86cd799439012',
      name: 'User #2',
      login: 'user2@test.com',
      descr: 'Test user 2',
      roles: [Role.User],
      contacts: [],
      toObject: jest.fn().mockReturnThis(),
    },
    {
      _id: '507f1f77bcf86cd799439013',
      name: 'User #3',
      login: 'user3@test.com',
      descr: 'Test user 3',
      roles: [Role.Admin],
      contacts: [],
      toObject: jest.fn().mockReturnThis(),
    },
  ] as unknown as UserDocument[];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getAll: jest.fn(),
            create: jest.fn(),
            getById: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  describe('create()', () => {
    it('should create a new user and return UserResponseDto', async () => {
      const createSpy = jest
        .spyOn(service, 'create')
        .mockResolvedValueOnce(mockUserDocument);

      const expectedResponse = new UserResponseDto({
        _id: '507f1f77bcf86cd799439011',
        name: 'User #1',
        login: 'user1@test.com',
        roles: [Role.User],
        descr: 'Test user description',
        contacts: [],
      });

      const result = await controller.create(createUserDto);

      expect(createSpy).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(expectedResponse);
      expect(result).toBeInstanceOf(UserResponseDto);
    });
  });

  describe('getAll()', () => {
    it('should return an array of UserResponseDto', async () => {
      const getAllSpy = jest
        .spyOn(service, 'getAll')
        .mockResolvedValueOnce(mockAllUsersDocuments);

      const expectedResponse = [
        new UserResponseDto({
          _id: '507f1f77bcf86cd799439011',
          name: 'User #1',
          login: 'user1@test.com',
          descr: 'Test user 1',
          roles: [Role.User],
          contacts: [],
        }),
        new UserResponseDto({
          _id: '507f1f77bcf86cd799439012',
          name: 'User #2',
          login: 'user2@test.com',
          descr: 'Test user 2',
          roles: [Role.User],
          contacts: [],
        }),
        new UserResponseDto({
          _id: '507f1f77bcf86cd799439013',
          name: 'User #3',
          login: 'user3@test.com',
          descr: 'Test user 3',
          roles: [Role.Admin],
          contacts: [],
        }),
      ];

      const result = await controller.getAll();

      expect(getAllSpy).toHaveBeenCalled();
      expect(result).toEqual(expectedResponse);
      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(UserResponseDto);
    });

    it('should return empty array when no users found', async () => {
      const getAllSpy = jest.spyOn(service, 'getAll').mockResolvedValueOnce([]);

      const result = await controller.getAll();

      expect(getAllSpy).toHaveBeenCalled();
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('getMe()', () => {
    it('should return current user as UserResponseDto', () => {
      const expectedResponse = new UserResponseDto({
        _id: '507f1f77bcf86cd799439011',
        name: 'User #1',
        login: 'user1@test.com',
        roles: [Role.User],
        descr: 'Test user description',
        contacts: [],
      });

      const result = controller.getMe(mockUserDocument);

      expect(result).toEqual(expectedResponse);
      expect(result).toBeInstanceOf(UserResponseDto);
    });
  });

  describe('getOne()', () => {
    it('should return a user by id as UserResponseDto', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const getByIdSpy = jest
        .spyOn(service, 'getById')
        .mockResolvedValueOnce(mockUserDocument);

      const expectedResponse = new UserResponseDto({
        _id: '507f1f77bcf86cd799439011',
        name: 'User #1',
        login: 'user1@test.com',
        roles: [Role.User],
        descr: 'Test user description',
        contacts: [],
      });

      const result = await controller.getOne(userId);

      expect(getByIdSpy).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResponse);
      expect(result).toBeInstanceOf(UserResponseDto);
    });
  });

  describe('update()', () => {
    it('should update a user and return updated UserResponseDto', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const updateSpy = jest
        .spyOn(service, 'update')
        .mockResolvedValueOnce(mockUpdatedUserDocument);

      const expectedResponse = new UserResponseDto({
        _id: '507f1f77bcf86cd799439011',
        name: 'Updated User',
        login: 'user1@test.com',
        roles: [Role.User],
        descr: 'Updated description',
        contacts: [],
      });

      const result = await controller.update(userId, updateUserDto);

      expect(updateSpy).toHaveBeenCalledWith(userId, updateUserDto);
      expect(result).toEqual(expectedResponse);
      expect(result).toBeInstanceOf(UserResponseDto);
    });
  });

  describe('remove()', () => {
    it('should remove a user and return the removed UserDocument', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const removeSpy = jest
        .spyOn(service, 'remove')
        .mockResolvedValueOnce(mockUserDocument);

      const result = await controller.remove(userId);

      expect(removeSpy).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUserDocument);
    });

    it('should return null when user not found for removal', async () => {
      const userId = 'nonexistent';
      const removeSpy = jest
        .spyOn(service, 'remove')
        .mockResolvedValueOnce(null);

      const result = await controller.remove(userId);

      expect(removeSpy).toHaveBeenCalledWith(userId);
      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    describe('create()', () => {
      it('should propagate service errors during user creation', async () => {
        const createSpy = jest
          .spyOn(service, 'create')
          .mockRejectedValueOnce(new Error('Database connection failed'));

        await expect(controller.create(createUserDto)).rejects.toThrow(
          'Database connection failed',
        );
        expect(createSpy).toHaveBeenCalledWith(createUserDto);
      });
    });

    describe('getAll()', () => {
      it('should propagate service errors when fetching all users', async () => {
        const getAllSpy = jest
          .spyOn(service, 'getAll')
          .mockRejectedValueOnce(new Error('Database query failed'));

        await expect(controller.getAll()).rejects.toThrow(
          'Database query failed',
        );
        expect(getAllSpy).toHaveBeenCalled();
      });
    });

    describe('getOne()', () => {
      it('should propagate service errors when fetching user by id', async () => {
        const userId = '507f1f77bcf86cd799439011';
        const getByIdSpy = jest
          .spyOn(service, 'getById')
          .mockRejectedValueOnce(new Error('User not found'));

        await expect(controller.getOne(userId)).rejects.toThrow(
          'User not found',
        );
        expect(getByIdSpy).toHaveBeenCalledWith(userId);
      });
    });

    describe('update()', () => {
      it('should propagate service errors during user update', async () => {
        const userId = '507f1f77bcf86cd799439011';
        const updateSpy = jest
          .spyOn(service, 'update')
          .mockRejectedValueOnce(new Error('Update validation failed'));

        await expect(controller.update(userId, updateUserDto)).rejects.toThrow(
          'Update validation failed',
        );
        expect(updateSpy).toHaveBeenCalledWith(userId, updateUserDto);
      });
    });

    describe('remove()', () => {
      it('should propagate service errors during user removal', async () => {
        const userId = '507f1f77bcf86cd799439011';
        const removeSpy = jest
          .spyOn(service, 'remove')
          .mockRejectedValueOnce(
            new Error('Cannot delete user with active sessions'),
          );

        await expect(controller.remove(userId)).rejects.toThrow(
          'Cannot delete user with active sessions',
        );
        expect(removeSpy).toHaveBeenCalledWith(userId);
      });
    });
  });
});
