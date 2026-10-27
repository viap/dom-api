import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

const mockUser = {
  name: 'User #1',
  descr: 'Breed #1',
};

describe('UsersService', () => {
  let service: UsersService;
  let model: Model<User>;

  const usersArray = [
    {
      name: 'User #1',
      descr: 'Breed #1',
    },
    {
      name: 'User #2',
      descr: 'Breed #2',
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
            findOne: jest.fn(),
            findByIdAndUpdate: jest.fn(),
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
      } as any),
    );
    const newUser = await service.create({
      name: 'User #1',
      descr: 'Breed #1',
    });
    expect(newUser).toEqual(mockUser);
  });

  describe('getByAuthUser', () => {
    const passwordHash = bcrypt.hashSync('right-password', 4);

    function mockFindOneSequence(...results: unknown[]) {
      const findOne = model.findOne as jest.Mock;
      results.forEach((result) => {
        findOne.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(result),
          }),
        });
      });
      return findOne;
    }

    it('matches the telegram username literally, not as a pattern', async () => {
      const findOne = mockFindOneSequence(null, null);

      await service.getByAuthUser({ login: '.*', password: 'x' });

      const regex = findOne.mock.calls[1][0]['contacts.username'].$regex;
      expect(regex.test('.*')).toBe(true);
      expect(regex.test('victim')).toBe(false);
    });

    it('does not assign a login when the password is wrong', async () => {
      mockFindOneSequence(null, {
        _id: 'user-id',
        password: passwordHash,
      });

      await expect(
        service.getByAuthUser({ login: 'victim', password: 'wrong' }),
      ).resolves.toBeNull();
      expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('assigns the telegram username as login after a valid password', async () => {
      const findOne = mockFindOneSequence(null, {
        _id: 'user-id',
        password: passwordHash,
      });
      // validateUniqueLogin -> getByLogin
      findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      const user = await service.getByAuthUser({
        login: 'Victim',
        password: 'right-password',
      });

      expect(user?.login).toBe('victim');
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith('user-id', {
        login: 'victim',
      });
    });
  });

  describe('getByTelegramId', () => {
    let updateOne: jest.Mock;

    function mockOwner(owner: unknown) {
      (model.findOne as jest.Mock).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(owner),
      });
    }

    function mockLegacy(result: unknown[]) {
      const sort = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(result),
        }),
      });
      (model.find as jest.Mock).mockReturnValueOnce({ sort });
      return sort;
    }

    beforeEach(() => {
      updateOne = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
      (model as any).updateOne = updateOne;
    });

    it('finds the account that owns telegramId first', async () => {
      mockOwner({ _id: 'owner' });

      await expect(service.getByTelegramId('42')).resolves.toEqual({
        _id: 'owner',
      });
      expect(model.findOne).toHaveBeenCalledWith({ telegramId: '42' });
      expect(model.find).not.toHaveBeenCalled();
    });

    it('lets a legacy account claim the id by its Telegram contact', async () => {
      mockOwner(null);
      mockLegacy([{ _id: 'u1' }]);

      await expect(service.getByTelegramId('42')).resolves.toEqual({
        _id: 'u1',
      });
      expect(model.find).toHaveBeenCalledWith({
        contacts: { $elemMatch: { id: '42', network: 'telegram' } },
      });
      expect(updateOne).toHaveBeenCalledWith(
        { _id: 'u1', telegramId: { $exists: false } },
        { $set: { telegramId: '42' } },
      );
    });

    it('picks the oldest legacy account when several share the id', async () => {
      mockOwner(null);
      const sort = mockLegacy([{ _id: 'u1' }, { _id: 'u2' }]);

      await expect(service.getByTelegramId('42')).resolves.toEqual({
        _id: 'u1',
      });
      expect(sort).toHaveBeenCalledWith({ _id: 1 });
    });

    it('returns the concurrent owner when the claim loses a race', async () => {
      mockOwner(null);
      mockLegacy([{ _id: 'u1' }]);
      updateOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue({ code: 11000 }),
      });
      mockOwner({ _id: 'winner' });

      await expect(service.getByTelegramId('42')).resolves.toEqual({
        _id: 'winner',
      });
    });

    it('returns null when nobody has the id', async () => {
      mockOwner(null);
      mockLegacy([]);

      await expect(service.getByTelegramId('42')).resolves.toBeNull();
      expect(updateOne).not.toHaveBeenCalled();
    });
  });

  it('createFromTelegram stores the Telegram login identity', async () => {
    (model.create as jest.Mock).mockResolvedValueOnce({ _id: 'u1' });

    await service.createFromTelegram({ id: '42', username: 'neo' });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: '42' }),
    );
  });
});
