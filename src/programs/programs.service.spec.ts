import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainsService } from '@/domains/domains.service';
import { PartnersService } from '@/partners/partners.service';
import { PeopleService } from '@/people/people.service';
import { ProgramStatus } from './enums/program-status.enum';
import { Program } from './schemas/program.schema';
import { ProgramsService } from './programs.service';

describe('ProgramsService', () => {
  let service: ProgramsService;

  const mockProgram = {
    _id: '507f1f77bcf86cd799439011',
    domainId: '507f1f77bcf86cd799439012',
    kind: 'school',
    status: ProgramStatus.Upcoming,
    title: 'Program',
    slug: 'program',
    startDate: '2026-04-20T10:00:00.000Z',
    endDate: '2026-04-21T10:00:00.000Z',
    applicationDeadline: '2026-04-19T10:00:00.000Z',
    speakerIds: [],
    organizerIds: [],
    partnerIds: [],
    schemaVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSave = jest.fn().mockResolvedValue(mockProgram);
  const mockInstance = { save: mockSave };
  const mockProgramModel = Object.assign(
    jest.fn().mockImplementation(() => mockInstance),
    {
      find: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
    },
  );

  const mockDomainsService = {
    getActiveById: jest.fn(),
  };

  const mockPeopleService = {
    exists: jest.fn(),
  };

  const mockPartnersService = {
    exists: jest.fn(),
  };
  const createFindQueryMock = (result: unknown[] = []) => {
    const exec = jest.fn().mockResolvedValue(result);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });

    return {
      sort,
      skip,
      limit,
      lean,
      exec,
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgramsService,
        {
          provide: getModelToken(Program.name),
          useValue: mockProgramModel,
        },
        { provide: DomainsService, useValue: mockDomainsService },
        { provide: PeopleService, useValue: mockPeopleService },
        { provide: PartnersService, useValue: mockPartnersService },
      ],
    }).compile();

    service = module.get<ProgramsService>(ProgramsService);
    jest.clearAllMocks();
    mockDomainsService.getActiveById.mockResolvedValue({
      _id: mockProgram.domainId,
    });
    mockPeopleService.exists.mockResolvedValue(true);
    mockPartnersService.exists.mockResolvedValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should require domainId for public list queries', async () => {
    await expect(service.findAll({})).rejects.toThrow(BadRequestException);
  });

  it('should filter public list by allowed statuses', async () => {
    const findQuery = createFindQueryMock([mockProgram]);
    mockProgramModel.find.mockReturnValue(findQuery);

    const result = await service.findAll({ domainId: mockProgram.domainId });

    expect(mockDomainsService.getActiveById).toHaveBeenCalledWith(
      mockProgram.domainId,
    );
    expect(mockProgramModel.find).toHaveBeenCalledWith({
      domainId: mockProgram.domainId,
      status: {
        $in: ['upcoming', 'active', 'completed', 'cancelled'],
      },
    });
    expect(findQuery.sort).toHaveBeenCalledWith({ startDate: 1, title: 1 });
    expect(findQuery.skip).toHaveBeenCalledWith(0);
    expect(findQuery.limit).toHaveBeenCalledWith(20);
    expect(result).toEqual([mockProgram]);
  });

  it('should return admin list without public status filtering', async () => {
    const findQuery = createFindQueryMock([mockProgram]);
    mockProgramModel.find.mockReturnValue(findQuery);

    const result = await service.findAllAdmin({
      domainId: mockProgram.domainId,
    });

    expect(mockDomainsService.getActiveById).toHaveBeenCalledWith(
      mockProgram.domainId,
    );
    expect(mockProgramModel.find).toHaveBeenCalledWith({
      domainId: mockProgram.domainId,
    });
    expect(findQuery.sort).toHaveBeenCalledWith({ startDate: 1, title: 1 });
    expect(findQuery.skip).toHaveBeenCalledWith(0);
    expect(findQuery.limit).toHaveBeenCalledWith(20);
    expect(result).toEqual([mockProgram]);
  });

  it('should return cross-domain admin list when domainId is missing', async () => {
    const findQuery = createFindQueryMock([mockProgram]);
    mockProgramModel.find.mockReturnValue(findQuery);

    const result = await service.findAllAdmin({});

    expect(mockDomainsService.getActiveById).not.toHaveBeenCalled();
    expect(mockProgramModel.find).toHaveBeenCalledWith({});
    expect(findQuery.sort).toHaveBeenCalledWith({ startDate: 1, title: 1 });
    expect(findQuery.skip).toHaveBeenCalledWith(0);
    expect(findQuery.limit).toHaveBeenCalledWith(20);
    expect(result).toEqual([mockProgram]);
  });

  it('should reject duplicate slug within the same domain', async () => {
    mockProgramModel.findOne.mockResolvedValue(mockProgram);

    await expect(
      service.create({
        domainId: mockProgram.domainId,
        kind: 'school' as any,
        title: 'Program',
        slug: 'program',
        format: 'online' as any,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject missing referenced partner ids', async () => {
    mockProgramModel.findOne.mockResolvedValue(null);
    mockPartnersService.exists.mockResolvedValue(false);

    await expect(
      service.create({
        domainId: mockProgram.domainId,
        kind: 'school' as any,
        title: 'Program',
        slug: 'program-2',
        format: 'online' as any,
        partnerIds: ['507f1f77bcf86cd799439099'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException for invalid public item ids', async () => {
    await expect(service.findOne('invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
