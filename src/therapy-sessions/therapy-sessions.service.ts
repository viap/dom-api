import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Price } from 'src/common/schemas/price.schema';
import groupBy from 'src/common/utils/group-by';
import { Currencies } from 'src/psychologists/enums/currencies.enum';
import { PsychologistsService } from 'src/psychologists/psychologists.service';
import { PsychologistDocument } from 'src/psychologists/schemas/psychologist.schema';
import { UsersService } from 'src/users/users.service';
import { CreateTherapySessionDto } from './dto/create-therapy-session.dto';
import { TherapySessionsControllerStatistic } from './dto/therapy-sessions-statistic.dto';
import { UpdateTherapySessionDto } from './dto/update-therapy-session.dto';
import {
  TherapySession,
  TherapySessionDocument,
} from './schemas/therapy-session.schema';
// import { from as fromArr, groupBy, mergeMap, toArray } from 'rxjs';

const submodels = [
  'psychologist',
  'client',
  {
    path: 'psychologist',
    populate: {
      path: 'user',
      model: 'User',
    },
  },
];

const oneDay = 1000 * 60 * 60 * 24;

@Injectable()
export class TherapySessionsService {
  constructor(
    @InjectModel(TherapySession.name)
    private therapySessionModel: Model<TherapySession>,
    private psychologistsService: PsychologistsService,
    private usersService: UsersService,
  ) {}

  async getAll(
    from?: number,
    to?: number,
  ): Promise<Array<TherapySessionDocument>> {
    if (from && to) {
      return this.therapySessionModel
        .find({
          $and: [{ timestamp: { $gte: from } }, { timestamp: { $lte: to } }],
        })
        .populate(submodels)
        .exec();
    } else {
      return this.therapySessionModel.find().populate(submodels).exec();
    }
  }

  async getById(id: string): Promise<TherapySessionDocument> {
    return this.therapySessionModel.findById(id).populate(submodels).exec();
  }

  async getStatisticForPeriod(
    from: number,
    to: number,
    psychologistId?: string,
  ): Promise<Array<TherapySessionsControllerStatistic>> {
    const sessionIndex = (session: TherapySession) =>
      `${session.psychologist._id}-${session.client._id}`;

    const calcPrices = (prices: Array<Price>) => {
      const aggregatedPrices = prices.reduce((acc, cur) => {
        if (acc[cur.currency]) {
          acc[cur.currency] = acc[cur.currency] + cur.value;
        } else {
          acc[cur.currency] = cur.value;
        }
        return acc;
      }, {});

      return Object.entries(aggregatedPrices).map(
        ([currency, price]: [Currencies, number]) => {
          return {
            currency,
            value: price,
          } as Price;
        },
      );
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
        comission: calcPrices(sessionGroup.map((s) => s.comission)),
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
      if (from && to) {
        return await this.therapySessionModel
          .find({
            $and: [
              { psychologist: psychologistId },
              { timestamp: { $gte: from } },
              { timestamp: { $lte: to } },
            ],
          })
          .populate(submodels)
          .exec();
      } else {
        return await this.therapySessionModel
          .find({ psychologist: psychologistId })
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
      return await this.therapySessionModel
        .find({ psychologist: psychologistId, client: clientId })
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

    return this.createFor(psychologist, createData);
  }

  async createFor(
    psychologist: PsychologistDocument,
    createData: CreateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    const client = await this.usersService.getById(createData.client);
    return this.therapySessionModel.create({
      ...createData,
      psychologist: psychologist._id,
      client: client._id,
    });
  }

  async update(
    id: string,
    updateData: UpdateTherapySessionDto,
  ): Promise<TherapySessionDocument> {
    await this.therapySessionModel.findByIdAndUpdate(id, updateData);
    return this.getById(id);
  }

  async remove(id: string): Promise<boolean> {
    const therapySession = await this.getById(id);
    if (therapySession && Date.now() - therapySession.timestamp < oneDay * 7) {
      return !!(await therapySession.deleteOne());
    }

    return false;
  }
}
