import { ConflictException } from '@nestjs/common';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { EventsService } from '@/events/events.service';
import { EventStatus } from '@/events/enums/event-status.enum';
import {
  DomainEvent,
  DomainEventDocument,
  domainEventSchema,
} from '@/events/schemas/domain-event.schema';
import { normalizeEventSchedule } from '@/events/utils/event-schedule';

const DEFAULT_TEST_MONGO_URL =
  'mongodb://127.0.0.1:27017/dom_recurring_event_race_test';

function getTestMongoUrl(
  value = process.env.MONGO_TEST_URL || DEFAULT_TEST_MONGO_URL,
): string {
  const parsed = new URL(value);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('MONGO_TEST_URL must target a loopback MongoDB server');
  }
  if (!databaseName || !databaseName.toLowerCase().includes('test')) {
    throw new Error(
      'MONGO_TEST_URL must include an explicit test database name',
    );
  }
  return value;
}

describe('recurring Event concurrent completion', () => {
  let connection: Connection;
  let model: Model<DomainEventDocument>;

  beforeAll(async () => {
    connection = await mongoose.createConnection(getTestMongoUrl()).asPromise();
    model = connection.model<DomainEventDocument>(
      `${DomainEvent.name}RecurringRace`,
      domainEventSchema,
      'events',
    );
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('refuses non-local or non-test Mongo targets', () => {
    expect(() => getTestMongoUrl('mongodb://mongo.example/dom_test')).toThrow(
      'loopback',
    );
    expect(() => getTestMongoUrl('mongodb://127.0.0.1/domData')).toThrow(
      'test database',
    );
    expect(() =>
      getTestMongoUrl(
        'mongodb://root:example@127.0.0.1:27017/dom_recurring_event_race_test?authSource=admin',
      ),
    ).not.toThrow();
  });

  it('keeps completed manual Events out of the Default past fill', async () => {
    const domainId = new Types.ObjectId();
    const now = new Date('2026-09-10T12:00:00.000Z');
    const commonEventFields = {
      domainId,
      type: 'seminar',
      speakerIds: [],
      organizerIds: [],
      partnerIds: [],
      registration: { isOpen: false },
      program: [],
      learnings: [],
      blocks: [],
      schemaVersion: 1,
    };
    const futureCompleted = await model.create({
      ...commonEventFields,
      status: EventStatus.Completed,
      title: 'Future completed manual Event',
      slug: 'future-completed-manual-event',
      startAt: '2026-09-11T10:00:00.000Z',
      endAt: '2026-09-11T12:00:00.000Z',
      schedule: normalizeEventSchedule({
        timezone: 'Asia/Tbilisi',
        mode: 'manual',
        days: [
          {
            date: '2026-09-11',
            startTime: '14:00',
            endTime: '16:00',
          },
        ],
      }).schedule,
    });
    const past = await model.create({
      ...commonEventFields,
      status: EventStatus.Planned,
      title: 'Past manual Event',
      slug: 'past-manual-event',
      startAt: '2026-09-09T10:00:00.000Z',
      endAt: '2026-09-09T12:00:00.000Z',
      schedule: normalizeEventSchedule({
        timezone: 'Asia/Tbilisi',
        mode: 'manual',
        days: [
          {
            date: '2026-09-09',
            startTime: '14:00',
            endTime: '16:00',
          },
        ],
      }).schedule,
    });
    const service = new EventsService(
      model,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const expectedIds = [futureCompleted._id.toString(), past._id.toString()];

    const summaries = await service.findDynamicSummaries({}, 2, {
      domainId: domainId.toString(),
      now,
    });
    const preview = await service.findDynamicPreviewItems({}, 2, {
      domainId: domainId.toString(),
      now,
    });

    expect(summaries.map((item) => item.id)).toEqual(expectedIds);
    expect(preview.map((item) => item.id)).toEqual(expectedIds);
    expect(new Set(summaries.map((item) => item.id)).size).toBe(2);
    expect(new Set(preview.map((item) => item.id)).size).toBe(2);
  });

  it('keeps a completed recurring Event in the past projection', async () => {
    const domainId = new Types.ObjectId();
    const recurring = await model.create({
      domainId,
      type: 'seminar',
      status: EventStatus.Completed,
      title: 'Completed recurring Event',
      slug: 'completed-recurring-event',
      startAt: '2026-09-01T10:00:00.000Z',
      endAt: '2026-10-01T12:00:00.000Z',
      schedule: normalizeEventSchedule({
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-09-01',
          startTime: '14:00',
          endTime: '16:00',
          endDate: '2026-10-01',
        },
        cancelledDates: [],
        overrides: [],
      }).schedule,
      speakerIds: [],
      organizerIds: [],
      partnerIds: [],
      registration: { isOpen: false },
      program: [],
      learnings: [],
      blocks: [],
      schemaVersion: 1,
    });
    const service = new EventsService(
      model,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.findDynamicSummaries({ temporal: { mode: 'past' } }, 1, {
        domainId: domainId.toString(),
        now: new Date('2026-09-10T12:00:00.000Z'),
      }),
    ).resolves.toEqual([
      { id: recurring._id.toString(), label: 'Completed recurring Event' },
    ]);
  });

  it('allows only one write from the same validated revision', async () => {
    const domainId = new Types.ObjectId();
    const created = await model.create({
      domainId,
      type: 'seminar',
      status: EventStatus.Planned,
      title: 'Concurrent series',
      slug: 'concurrent-series',
      startAt: '2026-04-20T10:00:00.000Z',
      endAt: '2026-04-20T12:00:00.000Z',
      schedule: normalizeEventSchedule({
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-04-20',
          startTime: '14:00',
          endTime: '16:00',
        },
        cancelledDates: [],
        overrides: [],
      }).schedule,
      speakerIds: [],
      organizerIds: [],
      partnerIds: [],
      registration: { isOpen: false },
      program: [],
      learnings: [],
      blocks: [],
      schemaVersion: 1,
    });

    let readCount = 0;
    let releaseReads!: () => void;
    const bothRead = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const wrappedModel = {
      findById: (id: string) => ({
        lean: () => ({
          exec: async () => {
            const event = await model.findById(id).lean().exec();
            readCount += 1;
            if (readCount === 2) releaseReads();
            await bothRead;
            return event;
          },
        }),
      }),
      findOne: model.findOne.bind(model),
      findOneAndUpdate: model.findOneAndUpdate.bind(model),
    } as unknown as Model<DomainEventDocument>;
    const service = new EventsService(
      wrappedModel,
      {} as never,
      {
        getActiveById: jest.fn().mockResolvedValue({ _id: domainId }),
      } as never,
      { exists: jest.fn() } as never,
      { existsPublished: jest.fn() } as never,
      { exists: jest.fn() } as never,
      { exists: jest.fn() } as never,
    );

    const completion = service.update(created._id.toString(), {
      status: EventStatus.Completed,
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-04-20',
          startTime: '14:00',
          endTime: '16:00',
          endDate: '2026-05-04',
        },
        cancelledDates: [],
        overrides: [],
      },
    });
    const scheduleEdit = service.update(created._id.toString(), {
      schedule: {
        timezone: 'Asia/Tbilisi',
        mode: 'recurring',
        recurrence: {
          unit: 'week',
          interval: 1,
          anchorDate: '2026-04-20',
          startTime: '15:00',
          endTime: '17:00',
        },
        cancelledDates: [],
        overrides: [],
      },
    });

    const results = await Promise.allSettled([completion, scheduleEdit]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toBeInstanceOf(ConflictException);

    const finalEvent = await model.findById(created._id).lean().exec();
    expect(finalEvent?.__v).toBe(1);
    expect(() => normalizeEventSchedule(finalEvent?.schedule)).not.toThrow();
    if (finalEvent?.status === EventStatus.Completed) {
      expect(finalEvent.schedule?.mode).toBe('recurring');
      if (finalEvent.schedule?.mode === 'recurring') {
        expect(finalEvent.schedule.recurrence.endDate).toBe('2026-05-04');
      }
    }
  });
});
