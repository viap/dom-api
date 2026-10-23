import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { TherapyRequestsController } from './therapy-requests.controller';
import { TherapyRequestsGuard } from './therapy-requests.guard';
import { TherapyRequestsService } from './therapy-requests.service';
import { EnhancedRequest } from '../common/types/enhanced-request.interface';
import { ROLES_KEY } from '../roles/decorators/role.docorator';
import { Role } from '../roles/enums/roles.enum';

describe('RequestsController', () => {
  let controller: TherapyRequestsController;
  let service: { update: jest.Mock; acceptRequest: jest.Mock };

  beforeEach(async () => {
    const mockTherapyRequestsService = {
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      acceptRequest: jest.fn(),
    };

    const mockPsychologistsService = {
      getByUserId: jest.fn(),
    };

    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TherapyRequestsController],
      providers: [
        {
          provide: TherapyRequestsService,
          useValue: mockTherapyRequestsService,
        },
        {
          provide: TherapyRequestsGuard,
          useValue: {},
        },
        {
          provide: PsychologistsService,
          useValue: mockPsychologistsService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    })
      .overrideGuard(TherapyRequestsGuard)
      .useValue({})
      .compile();

    controller = module.get<TherapyRequestsController>(
      TherapyRequestsController,
    );
    service = mockTherapyRequestsService;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('update()', () => {
    const request = (roles: Role[]) =>
      ({
        userContext: { userId: 'user-id', roles },
        psychologistContext: { id: 'p1' },
      } as EnhancedRequest);

    it('lets a psychologist transfer their request', async () => {
      await controller.update(request([Role.Psychologist]), 'r1', {
        psychologist: 'p2',
      } as any);

      expect(service.update).toHaveBeenCalledWith(
        'r1',
        { psychologist: 'p2' },
        'p1',
      );
    });

    it.each([{ name: 'x' }, { psychologist: 'p2', user: 'u1' }])(
      'forbids a psychologist from changing %o',
      (data) => {
        expect(() =>
          controller.update(request([Role.Psychologist]), 'r1', data as any),
        ).toThrow(ForbiddenException);
        expect(service.update).not.toHaveBeenCalled();
      },
    );

    it('rejects an empty transfer from a psychologist with 400', () => {
      expect(() =>
        controller.update(request([Role.Psychologist]), 'r1', {} as any),
      ).toThrow(BadRequestException);
    });

    it('lets an editor change any field', async () => {
      await controller.update(request([Role.Editor]), 'r1', {
        name: 'x',
      } as any);

      expect(service.update).toHaveBeenCalled();
    });
  });

  it.each(['getAll', 'create', 'remove'] as const)(
    '%s is limited to admins and editors',
    (method) => {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          TherapyRequestsController.prototype[method],
        ),
      ).toEqual([Role.Admin, Role.Editor]);
    },
  );

  describe('acceptRequest()', () => {
    it('binds a psychologist claim to their own profile', () => {
      controller.acceptRequest(
        {
          userContext: { userId: 'u', roles: [Role.Psychologist] },
          psychologistContext: { id: 'p1' },
        } as EnhancedRequest,
        'r1',
      );

      expect(service.acceptRequest).toHaveBeenCalledWith('r1', 'p1');
    });

    it('lets admins accept regardless of their own profile', () => {
      controller.acceptRequest(
        {
          userContext: { userId: 'u', roles: [Role.Admin] },
          psychologistContext: { id: 'p-admin' },
        } as EnhancedRequest,
        'r1',
      );

      expect(service.acceptRequest).toHaveBeenCalledWith('r1', undefined);
    });
  });
});
