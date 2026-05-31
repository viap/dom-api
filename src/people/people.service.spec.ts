import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from '@/media/media.service';
import { UsersService } from '@/users/users.service';
import { PersonRole } from './enums/person-role.enum';
import { Person } from './schemas/person.schema';
import { PeopleService } from './people.service';

describe('PeopleService', () => {
  let service: PeopleService;

  const createLeanExecChain = (value: unknown) => ({
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(value),
    }),
  });
  const createLeanRejectChain = (error: unknown) => ({
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockRejectedValue(error),
    }),
  });

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
      findByIdAndUpdate: jest.fn(),
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
    mockPersonModel.findOne.mockReturnValue(createLeanExecChain(null));
  });

  it('should reject unpublished media references for public people data', async () => {
    mockMediaService.existsPublished.mockResolvedValue(false);

    await expect(
      service.create({
        slug: 'john-doe',
        fullName: 'John Doe',
        photoId: '507f1f77bcf86cd799439032',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should validate refs before checking slug uniqueness on create', async () => {
    mockMediaService.existsPublished.mockResolvedValue(false);

    await expect(
      service.create({
        slug: 'duplicate-slug',
        fullName: 'John Doe',
        photoId: '507f1f77bcf86cd799439032',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPersonModel.findOne).not.toHaveBeenCalled();
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
    mockPersonModel.findById.mockReturnValue(createLeanExecChain(person));

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

  it('should reject duplicate slug on create', async () => {
    mockPersonModel.findOne.mockReturnValue(
      createLeanExecChain({ _id: '507f1f77bcf86cd799439055' }),
    );

    await expect(
      service.create({
        slug: 'john-doe',
        fullName: 'John Doe',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should ignore falsy slug values in uniqueness checks for internal create calls', async () => {
    const result = await service.create({
      slug: undefined as never,
      fullName: 'Legacy Person',
    } as never);

    expect(mockPersonModel.findOne).not.toHaveBeenCalled();
    expect(result).toEqual({
      slug: undefined,
      fullName: 'Legacy Person',
    });
  });

  it('should translate duplicate key errors on create to conflict', async () => {
    mockSave.mockRejectedValueOnce({
      code: 11000,
      keyPattern: { slug: 1 },
    });

    await expect(
      service.create({
        slug: 'john-doe',
        fullName: 'John Doe',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject slug collision on update', async () => {
    mockPersonModel.findById.mockReturnValue(
      createLeanExecChain({
        _id: '507f1f77bcf86cd799439032',
        slug: 'john-doe',
      }),
    );
    mockPersonModel.findOne.mockReturnValue(
      createLeanExecChain({ _id: '507f1f77bcf86cd799439033' }),
    );

    await expect(
      service.update('507f1f77bcf86cd799439032', { slug: 'jane-doe' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should allow update without slug uniqueness false positive', async () => {
    const existingPerson = {
      _id: '507f1f77bcf86cd799439032',
      slug: 'john-doe',
      fullName: 'John Doe',
    };
    const updatedPerson = {
      ...existingPerson,
      bio: 'Updated bio',
    };

    mockPersonModel.findById.mockReturnValue(
      createLeanExecChain(existingPerson),
    );
    mockPersonModel.findByIdAndUpdate.mockReturnValue(
      createLeanExecChain(updatedPerson),
    );

    const result = await service.update('507f1f77bcf86cd799439032', {
      slug: 'john-doe',
      bio: 'Updated bio',
    });

    expect(mockPersonModel.findOne).not.toHaveBeenCalled();
    expect(result).toEqual(updatedPerson);
  });

  it('should skip slug prefetch when patch payload has no slug', async () => {
    const updatedPerson = {
      _id: '507f1f77bcf86cd799439032',
      slug: 'john-doe',
      fullName: 'John Doe',
      bio: 'Updated bio',
    };

    mockPersonModel.findByIdAndUpdate.mockReturnValue(
      createLeanExecChain(updatedPerson),
    );

    const result = await service.update('507f1f77bcf86cd799439032', {
      bio: 'Updated bio',
    });

    expect(mockPersonModel.findById).not.toHaveBeenCalled();
    expect(mockPersonModel.findOne).not.toHaveBeenCalled();
    expect(result).toEqual(updatedPerson);
  });

  it('should translate duplicate key errors on update to conflict', async () => {
    mockPersonModel.findById.mockReturnValue(
      createLeanExecChain({
        _id: '507f1f77bcf86cd799439032',
        slug: 'john-doe',
      }),
    );
    mockPersonModel.findByIdAndUpdate.mockReturnValue(
      createLeanRejectChain({
        code: 11000,
        keyPattern: { slug: 1 },
      }),
    );

    await expect(
      service.update('507f1f77bcf86cd799439032', { slug: 'jane-doe' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should return published person by slug', async () => {
    const person = {
      _id: '507f1f77bcf86cd799439032',
      slug: 'john-doe',
      fullName: 'John Doe',
      isPublished: true,
    };
    mockPersonModel.findOne.mockReturnValue(createLeanExecChain(person));

    const result = await service.findOneBySlug('john-doe');

    expect(mockPersonModel.findOne).toHaveBeenCalledWith({
      slug: 'john-doe',
      isPublished: true,
    });
    expect(result).toEqual(person);
  });

  it('should reject unpublished matching slug lookup', async () => {
    mockPersonModel.findOne.mockReturnValue(createLeanExecChain(null));

    await expect(service.findOneBySlug('john-doe')).rejects.toThrow(
      NotFoundException,
    );

    expect(mockPersonModel.findOne).toHaveBeenCalledWith({
      slug: 'john-doe',
      isPublished: true,
    });
  });

  it('should reject unknown slug lookup', async () => {
    mockPersonModel.findOne.mockReturnValue(createLeanExecChain(null));

    await expect(service.findOneBySlug('missing-person')).rejects.toThrow(
      NotFoundException,
    );
  });
});
