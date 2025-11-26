import { Test, TestingModule } from '@nestjs/testing';
import { PsychologistsController } from './psychologists.controller';
import { PsychologistsService } from './psychologists.service';

describe('PsychologistController', () => {
  let controller: PsychologistsController;

  beforeEach(async () => {
    const mockPsychologistsService = {
      getAll: jest.fn(),
      getById: jest.fn(),
      getByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addClientToPsychologist: jest.fn(),
      editMyClient: jest.fn(),
      removeMyClient: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PsychologistsController],
      providers: [
        {
          provide: PsychologistsService,
          useValue: mockPsychologistsService,
        },
      ],
    }).compile();

    controller = module.get<PsychologistsController>(PsychologistsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
