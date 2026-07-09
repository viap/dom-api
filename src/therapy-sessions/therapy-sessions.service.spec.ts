import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { PsychologistsService } from '../psychologists/psychologists.service';
import { TherapyRequest } from '../therapy-requests/schemas/therapy-request.schema';
import { UsersService } from '../users/users.service';
import { TherapySession } from './schemas/therapy-session.schema';
import { TherapySessionsService } from './therapy-sessions.service';

describe('TherapySessionsService', () => {
  let service: TherapySessionsService;
  let therapySessionModel: {
    find: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOne: jest.Mock;
    findByIdAndRemove: jest.Mock;
    aggregate: jest.Mock;
  };
  let therapyRequestModel: {
    findById: jest.Mock;
  };
  let psychologistsService: jest.Mocked<
    Pick<PsychologistsService, 'getById' | 'getByUserId'>
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getById'>>;

  const id = (value: string) => ({
    toString: () => value,
  });

  const chain = (result: unknown) => ({
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    therapySessionModel = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOne: jest.fn(),
      findByIdAndRemove: jest.fn(),
      aggregate: jest.fn(),
    };
    therapyRequestModel = {
      findById: jest.fn(),
    };

    psychologistsService = {
      getById: jest.fn(),
      getByUserId: jest.fn(),
    };

    usersService = {
      getById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TherapySessionsService,
        {
          provide: getModelToken(TherapySession.name),
          useValue: therapySessionModel,
        },
        {
          provide: getModelToken(TherapyRequest.name),
          useValue: therapyRequestModel,
        },
        {
          provide: PsychologistsService,
          useValue: psychologistsService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    service = module.get<TherapySessionsService>(TherapySessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects an explicit therapy request link from another psychologist', async () => {
    const psychologistId = '507f1f77bcf86cd799439011';
    const clientId = '507f1f77bcf86cd799439012';
    const therapyRequestId = '507f1f77bcf86cd799439013';

    usersService.getById.mockResolvedValue({ _id: id(clientId) } as any);
    therapyRequestModel.findById.mockReturnValue(
      chain({
        _id: id(therapyRequestId),
        psychologist: id('507f1f77bcf86cd799439099'),
        user: id(clientId),
      }),
    );

    await expect(
      service.createFor(psychologistId, {
        client: clientId,
        therapyRequest: therapyRequestId,
        duration: 50,
        price: { value: 100, currency: 'USD' },
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(therapySessionModel.create).not.toHaveBeenCalled();
  });

  it('accepts an explicit therapy request link for the same client and psychologist', async () => {
    const psychologistId = '507f1f77bcf86cd799439011';
    const clientId = '507f1f77bcf86cd799439012';
    const therapyRequestId = '507f1f77bcf86cd799439013';

    usersService.getById.mockResolvedValue({ _id: id(clientId) } as any);
    therapyRequestModel.findById.mockReturnValue(
      chain({
        _id: id(therapyRequestId),
        psychologist: id(psychologistId),
        user: id(clientId),
      }),
    );
    therapySessionModel.create.mockResolvedValue({ _id: id('session-1') });

    await service.createFor(psychologistId, {
      client: clientId,
      therapyRequest: therapyRequestId,
      duration: 50,
      price: { value: 100, currency: 'USD' },
    } as any);

    const createdPayload = therapySessionModel.create.mock.calls[0][0];
    expect(createdPayload).toEqual(
      expect.objectContaining({
        psychologist: psychologistId,
        therapyRequest: therapyRequestId,
      }),
    );
    expect(createdPayload.client.toString()).toBe(clientId);
  });

  it('links a session only when deterministic roster inference has exactly one match', async () => {
    const psychologistId = '507f1f77bcf86cd799439011';
    const clientId = '507f1f77bcf86cd799439012';
    const therapyRequestId = '507f1f77bcf86cd799439013';

    usersService.getById.mockResolvedValue({ _id: id(clientId) } as any);
    psychologistsService.getById.mockResolvedValue({
      clients: [{ user: id(clientId), therapyRequest: id(therapyRequestId) }],
    } as any);
    therapySessionModel.create.mockResolvedValue({ _id: id('session-1') });

    await service.createFor(psychologistId, {
      client: clientId,
      duration: 50,
      price: { value: 100, currency: 'USD' },
    } as any);

    expect(psychologistsService.getById).toHaveBeenCalledWith(
      psychologistId,
      false,
    );
    expect(therapySessionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        therapyRequest: therapyRequestId,
      }),
    );
  });

  it('leaves a session unlinked when deterministic roster inference is ambiguous', async () => {
    const psychologistId = '507f1f77bcf86cd799439011';
    const clientId = '507f1f77bcf86cd799439012';

    usersService.getById.mockResolvedValue({ _id: id(clientId) } as any);
    psychologistsService.getById.mockResolvedValue({
      clients: [
        { user: id(clientId), therapyRequest: id('507f1f77bcf86cd799439013') },
        { user: id(clientId), therapyRequest: id('507f1f77bcf86cd799439014') },
      ],
    } as any);
    therapySessionModel.create.mockResolvedValue({ _id: id('session-1') });

    await service.createFor(psychologistId, {
      client: clientId,
      duration: 50,
      price: { value: 100, currency: 'USD' },
    } as any);

    expect(therapySessionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        therapyRequest: undefined,
      }),
    );
  });

  it('does not pass through an unvalidated therapy request on update', async () => {
    const sessionId = '507f1f77bcf86cd799439010';
    const psychologistId = '507f1f77bcf86cd799439011';
    const clientId = '507f1f77bcf86cd799439012';
    const therapyRequestId = '507f1f77bcf86cd799439013';

    therapySessionModel.findById
      .mockReturnValueOnce(
        chain({
          _id: id(sessionId),
          psychologist: { _id: id(psychologistId) },
          client: { _id: id(clientId) },
        }),
      )
      .mockReturnValueOnce(chain({ _id: id(sessionId) }));
    therapyRequestModel.findById.mockReturnValue(
      chain({
        _id: id(therapyRequestId),
        psychologist: id('507f1f77bcf86cd799439099'),
        user: id(clientId),
      }),
    );

    await expect(
      service.update(sessionId, { therapyRequest: therapyRequestId } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(therapySessionModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('clears a therapy request link on update when therapyRequest is null', async () => {
    const sessionId = '507f1f77bcf86cd799439010';
    const psychologistId = '507f1f77bcf86cd799439011';
    const clientId = '507f1f77bcf86cd799439012';
    const existingTherapyRequestId = '507f1f77bcf86cd799439013';

    therapySessionModel.findById
      .mockReturnValueOnce(
        chain({
          _id: id(sessionId),
          psychologist: { _id: id(psychologistId) },
          client: { _id: id(clientId) },
          therapyRequest: id(existingTherapyRequestId),
        }),
      )
      .mockReturnValueOnce(
        chain({
          _id: id(sessionId),
          therapyRequest: null,
        }),
      );

    await service.update(sessionId, { therapyRequest: null });

    expect(therapyRequestModel.findById).not.toHaveBeenCalled();
    expect(therapySessionModel.findByIdAndUpdate).toHaveBeenCalledWith(
      sessionId,
      expect.objectContaining({
        therapyRequest: null,
      }),
    );
  });
});
