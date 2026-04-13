import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from '@/media/media.service';
import { UsersService } from '@/users/users.service';
import { Person } from './schemas/person.schema';
import { PeopleService } from './people.service';

describe('PeopleService', () => {
  let service: PeopleService;

  const mockPersonModel = jest.fn().mockImplementation((payload) => ({
    ...payload,
    save: jest.fn().mockResolvedValue(payload),
  }));
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
    mockUsersService.getById.mockResolvedValue({ _id: '507f1f77bcf86cd799439031' });
    mockMediaService.existsPublished.mockResolvedValue(true);
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
});
