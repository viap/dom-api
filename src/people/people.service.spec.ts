import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from '@/media/media.service';
import { UsersService } from '@/users/users.service';
import { PersonRole } from './enums/person-role.enum';
import { Person } from './schemas/person.schema';
import { PeopleService } from './people.service';

describe('PeopleService', () => {
  let service: PeopleService;

  const mockSave = jest.fn().mockImplementation(async (payload) => payload);
  const mockQueryExec = jest.fn().mockResolvedValue([]);
  const mockQueryChain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: mockQueryExec,
  };
  const mockPersonModel = Object.assign(
    jest.fn().mockImplementation((payload) => ({
      ...payload,
      save: jest.fn().mockImplementation(() => mockSave(payload)),
    })),
    {
      find: jest.fn().mockReturnValue(mockQueryChain),
      findById: jest.fn(),
      findOne: jest.fn(),
    },
  );
  const mockUsersService = {
    getById: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439031' }),
  };
  const mockMediaService = {
    existsPublished: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeopleService,
        { provide: getModelToken(Person.name), useValue: mockPersonModel },
        { provide: UsersService, useValue: mockUsersService },
        { provide: MediaService, useValue: mockMediaService },
      ],
    }).compile();

    service = module.get<PeopleService>(PeopleService);
    jest.clearAllMocks();
    mockUsersService.getById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439031',
    });
    mockMediaService.existsPublished.mockResolvedValue(true);
    mockQueryExec.mockResolvedValue([]);
  });

  it('should reject unpublished media references for public people data', async () => {
    mockMediaService.existsPublished.mockResolvedValue(false);

    await expect(
      service.create({
        fullName: 'John Doe',
        photoId: '507f1f77bcf86cd799439032',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should apply role filter when provided in findAll query params', async () => {
    await service.findAll({ role: PersonRole.Speaker });

    expect(mockPersonModel.find).toHaveBeenCalledWith({
      isPublished: true,
      roles: PersonRole.Speaker,
    });
    expect(mockQueryChain.sort).toHaveBeenCalledWith({ fullName: 1 });
  });

  it('should not include isPublished in admin list query', async () => {
    await service.findAllAdmin({ role: PersonRole.Speaker });

    expect(mockPersonModel.find).toHaveBeenCalledWith({
      roles: PersonRole.Speaker,
    });
    expect(mockQueryChain.sort).toHaveBeenCalledWith({ fullName: 1 });
  });

  it('should return unpublished person from admin read by id', async () => {
    const person = {
      _id: '507f1f77bcf86cd799439032',
      fullName: 'John Doe',
      isPublished: false,
    };
    const exec = jest.fn().mockResolvedValue(person);
    const lean = jest.fn().mockReturnValue({ exec });
    mockPersonModel.findById.mockReturnValue({ lean });

    const result = await service.findOneAdmin('507f1f77bcf86cd799439032');

    expect(mockPersonModel.findById).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439032',
    );
    expect(result).toEqual(person);
  });

  it('should throw NotFoundException for invalid admin read id', async () => {
    await expect(service.findOneAdmin('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
