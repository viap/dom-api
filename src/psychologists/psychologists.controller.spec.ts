import { Test, TestingModule } from '@nestjs/testing';
import { PsychologistsController } from './psychologists.controller';
import { PsychologistsService } from './psychologists.service';
import { ROLES_KEY } from '@/roles/decorators/role.docorator';
import { Role } from '@/roles/enums/roles.enum';

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

  it.each(['getAll', 'getOne'] as const)(
    '%s is not available to plain users',
    (method) => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        PsychologistsController.prototype[method],
      );

      expect(roles).toEqual([Role.Admin, Role.Editor, Role.Psychologist]);
    },
  );
});
