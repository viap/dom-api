import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Price } from '@/common/schemas/price.schema';
import groupBy from '@/common/utils/group-by';
import {
  sanitizeDateRange,
  validateObjectId,
} from '@/common/utils/mongo-sanitizer';
import { Currencies } from '@/psychologists/enums/currencies.enum';
import { PsychologistsService } from '@/psychologists/psychologists.service';
import {
  TherapyRequest,
  TherapyRequestDocument,
} from '@/therapy-requests/schemas/therapy-request.schema';
import { UsersService } from '@/users/users.service';
import { CreateTherapySessionDto } from './dto/create-therapy-session.dto';
import { TherapySessionsControllerStatistic } from './dto/therapy-sessions-statistic.dto';
import { UpdateTherapySessionDto } from './dto/update-therapy-session.dto';
import {
  TherapySession,
  TherapySessionDocument,
} from './schemas/therapy-session.schema';

const submodels = [
  'psychologist',
  'client',
  'therapyRequest',
  {
    path: 'psychologist',
    populate: {
      path: 'user',
      model: 'User',
    },
  },
];

const oneDay = 1000 * 60 * 60 * 24;

function toId(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  const record = value as {
    _id?: { toString: () => string };
    toString?: () => string;
  };
  return record._id?.toString?.() || record.toString?.();
}

function hasOwn(object: object, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, field);
}

@Injectable()
export class TherapySessionsService {
  constructor(
    @InjectModel(TherapySession.name)
    private therapySessionModel: Model<TherapySessionDocument>,
    @InjectModel(TherapyRequest.name)
    private therapyRequestModel: Model<TherapyRequestDocument>,
    private psychologistsService: PsychologistsService,
    private usersService: UsersService,
  ) {}

  async getAll(
    from?: number,
    to?: number,
  ): Promise<Array<TherapySessionDocument>> {
    const sanitizedDates = sanitizeDateRange(from, to);
    if (sanitizedDates.from && sanitizedDates.to) {
      return this.therapySessionModel
        .find({
          $and: [
            { dateTime: { $gte: sanitizedDates.from } },
            { dateTime: { $lte: sanitizedDates.to } },
          ],
        })
        .populate(submodels)
        .exec();
    } else {
      return this.therapySessionModel.find().populate(submodels).exec();
    }
  }

  async getById(id: string): Promise<TherapySessionDocument> {
    const validId = validateObjectId(id);
    if (!validId) {
      return null;
    }
    return this.therapySessionModel
      .findById(validId)
      .populate(submodels)
      .exec();
  }

  async getStatisticForPeriod(
    from: number,
    to: number,
    psychologistId?: string,
  ): Promise<Array<TherapySessionsControllerStatistic>> {
    const sessionIndex = (session: TherapySession) =>
      `${session.psychologist._id}-${session.client._id}`;

    const calcPrices = (prices: Array<Price>) => {
      const aggregatedPrices: Partial<Record<Currencies, number>> =
        prices.reduce((acc, cur) => {
          if (acc[cur.currency]) {
            acc[cur.currency] = acc[cur.currency] + cur.value;
          } else {
            acc[cur.currency] = cur.value;
          }
          return acc;
        }, {});

      return Object.entries(aggregatedPrices).map(([currency, price]) => {
        return {
          currency,
          value: price,
        } as Price;
      });
    };

    const sessions = psychologistId
      ? await this.getAllForPsychologist(psychologistId, from, to)
      : await this.getAll(from, to);

    const sessionNumbers: { [key: string]: number } = {};

    const groupedSessions = Object.values(
      groupBy(sessions, (session) => sessionIndex(session)),
    );

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      sessionNumbers[sessionIndex(session)] =
        await this.therapySessionModel.count({
          $and: [
            { psychologist: session.psychologist._id },
            { client: session.client._id },
          ],
        });
    }

    return groupedSessions.map((sessionGroup) => {
      const session = sessionGroup[sessionGroup.length - 1];
      return {
        psychologist: session.psychologist,
        client: session.client,
        from: new Date(from).toLocaleDateString('ru'),
        to: new Date(to).toLocaleDateString('ru'),
        price: calcPrices(sessionGroup.map((s) => s.price)),
        commission: calcPrices(sessionGroup.map((s) => s.commission)),
        countForPeriod: sessionGroup.length,
        countAll: sessionNumbers[sessionIndex(session)] || 0,
      } as TherapySessionsControllerStatistic;
    });
  }

  async getAllForPsychologist(
    psychologistId: string,
    from?: number,
    to?: number,
  ): Promise<Array<TherapySessionDocument>> {
    try {
      const validId = validateObjectId(psychologistId);
      if (!validId) {
        return [];
      }

      const sanitizedDates = sanitizeDateRange(from, to);
      if (sanitizedDates.from && sanitizedDates.to) {
        return await this.therapySessionModel
          .find({
            $and: [
              { psychologist: validId },
              { dateTime: { $gte: sanitizedDates.from } },
              { dateTime: { $lte: sanitizedDates.to } },
            ],
          })
          .populate(submodels)
          .exec();
      } else {
        return await this.therapySessionModel
          .find({ psychologist: validId })
          .populate(submodels)
          .exec();
      }
    } catch {
      return [];
    }
  }

  async getAllForPsychologistAndClient(
    psychologistId: string,
    clientId: string,
  ): Promise<Array<TherapySessionDocument>> {
    try {
      const validPsychologistId = validateObjectId(psychologistId);
      const validClientId = validateObjectId(clientId);

      if (!validPsychologistId || !validClientId) {
        return [];
      }

      return await this.therapySessionModel
        .find({ psychologist: validPsychologistId, client: validClientId })
        .populate(submodels)
        .exec();
    } catch {
      return [];
    }
  }

  async create(
    createData: CreateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    const psychologist = await this.psychologistsService.getById(
      createData.psychologist,
    );

    return this.createFor(psychologist._id, createData);
  }

  async createFor(
    psychologistId: string,
    createData: CreateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    const client = await this.usersService.getById(createData.client);
    const dateTime = createData.dateTime
      ? new Date(createData.dateTime).getTime()
      : Date.now();
    const therapyRequest = createData.therapyRequest
      ? await this.validateTherapyRequestLink(
          psychologistId,
          client._id.toString(),
          createData.therapyRequest,
        )
      : await this.resolveDeterministicTherapyRequestId(
          psychologistId,
          client._id.toString(),
        );
    return this.therapySessionModel.create({
      ...createData,
      dateTime,
      psychologist: psychologistId,
      client: client._id,
      therapyRequest,
    });
  }

  async update(
    id: string,
    updateData: UpdateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    const existingSession = await this.getById(id);
    if (!existingSession) {
      return null;
    }

    const dateTime = updateData.dateTime
      ? new Date(updateData.dateTime).getTime()
      : Date.now();
    const therapyRequest = hasOwn(updateData, 'therapyRequest')
      ? updateData.therapyRequest
        ? await this.validateTherapyRequestLink(
            existingSession.psychologist._id.toString(),
            existingSession.client._id.toString(),
            updateData.therapyRequest,
          )
        : updateData.therapyRequest
      : existingSession.therapyRequest;
    await this.therapySessionModel.findByIdAndUpdate(id, {
      ...updateData,
      dateTime,
      therapyRequest,
    });
    return this.getById(id);
  }

  async remove(id: string): Promise<boolean> {
    const therapySession = await this.getById(id);
    if (
      therapySession &&
      Date.now() - therapySession.createdAt.getTime() < oneDay * 7
    ) {
      return !!(await therapySession.deleteOne());
    }

    return false;
  }

  // NOTICE: start onece to set dateTime values for all sessions
  async migration_addDateTime() {
    await this.therapySessionModel
      .updateMany({}, { $unset: { date: 1 } })
      .exec();

    return true;
  }

  private async resolveDeterministicTherapyRequestId(
    psychologistId: string,
    clientId: string,
  ): Promise<string | undefined> {
    const psychologist = await this.psychologistsService.getById(
      psychologistId,
      false,
    );
    const matchingRequestIds = (psychologist?.clients || [])
      .filter((client) => {
        const userId = toId(client.user);
        return userId === clientId && !!client.therapyRequest;
      })
      .map((client) => toId(client.therapyRequest))
      .filter(Boolean);

    const uniqueRequestIds = Array.from(new Set(matchingRequestIds));
    return uniqueRequestIds.length === 1 ? uniqueRequestIds[0] : undefined;
  }

  private async validateTherapyRequestLink(
    psychologistId: string,
    clientId: string,
    therapyRequestId: string,
  ): Promise<string | undefined> {
    const validTherapyRequestId = validateObjectId(therapyRequestId);
    if (!validTherapyRequestId) {
      throw new BadRequestException('Invalid therapy request link');
    }

    const request = await this.therapyRequestModel
      .findById(validTherapyRequestId)
      .exec();

    if (!request) {
      throw new BadRequestException('Invalid therapy request link');
    }

    const requestPsychologistId = toId(request.psychologist);

    if (requestPsychologistId && requestPsychologistId !== psychologistId) {
      throw new BadRequestException('Invalid therapy request link');
    }

    const requestUserId = toId(request.user);

    if (requestUserId && requestUserId === clientId) {
      return validTherapyRequestId;
    }

    const deterministicRequestId =
      await this.resolveDeterministicTherapyRequestId(psychologistId, clientId);

    if (deterministicRequestId === validTherapyRequestId) {
      return validTherapyRequestId;
    }

    throw new BadRequestException('Invalid therapy request link');
  }
}
