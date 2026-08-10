import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Location } from './schemas/location.schema';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  let service: LocationsService;

  const mockLocationModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: getModelToken(Location.name), useValue: mockLocationModel },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
    jest.clearAllMocks();
  });

  it('should bulk resolve locations in input order and omit invalid ids', async () => {
    const firstLocation = {
      _id: '507f1f77bcf86cd799439061',
      title: 'First Location',
    };
    const secondLocation = {
      _id: '507f1f77bcf86cd799439062',
      title: 'Second Location',
    };
    mockLocationModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([secondLocation, firstLocation]),
      }),
    });

    const result = await service.findManyByIds([
      firstLocation._id,
      'invalid',
      secondLocation._id,
    ]);

    expect(mockLocationModel.find).toHaveBeenCalledWith({
      _id: { $in: [firstLocation._id, secondLocation._id] },
    });
    expect(result).toEqual({ items: [firstLocation, secondLocation] });
  });
});
