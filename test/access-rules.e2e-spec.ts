import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Booking } from '../src/booking-system/bookings/schemas/booking.schema';
import { Company } from '../src/booking-system/companies/schemas/company.schema';
import { Room } from '../src/booking-system/rooms/schemas/room.schema';
import { Schedule } from '../src/booking-system/schedules/schemas/schedule.schema';
import { Notification } from '../src/notifications/schemas/notification.schema';
import { Psychologist } from '../src/psychologists/schemas/psychologist.schema';
import { TherapyRequest } from '../src/therapy-requests/schemas/therapy-request.schema';
import { TherapySession } from '../src/therapy-sessions/schemas/therapy-session.schema';
import { User } from '../src/users/schemas/user.schema';
import { TestAppModule } from './test-app.module';

// Access rules through the real global and module guards. Models are mocked
// with chainable queries; only the data the guards look at is modelled.

const id = (n: number) => n.toString(16).padStart(24, '0');
const ADMIN = id(1);
const EDITOR = id(2);
const PLAIN = id(3);
const P1_USER = id(4);
const P2_USER = id(5);
const DELETED = id(6);
const ACCOUNTANT = id(7);
const P1 = id(11);
const P2 = id(12);
const REQUEST_OF_P2 = id(21);

const users: Record<string, { _id: string; roles: string[] }> = {
  [ADMIN]: { _id: ADMIN, roles: ['user', 'admin'] },
  [EDITOR]: { _id: EDITOR, roles: ['user', 'editor'] },
  [PLAIN]: { _id: PLAIN, roles: ['user'] },
  [P1_USER]: { _id: P1_USER, roles: ['user', 'psychologist'] },
  [P2_USER]: { _id: P2_USER, roles: ['user', 'psychologist'] },
  [ACCOUNTANT]: { _id: ACCOUNTANT, roles: ['user', 'accountant'] },
};
const psychologistsByUser: Record<string, { _id: string }> = {
  [P1_USER]: { _id: P1 },
  [P2_USER]: { _id: P2 },
};

// A query that accepts any chained call and resolves to `value`.
function query(value: unknown): any {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'exec') return () => Promise.resolve(value);
        if (prop === 'then') {
          return (resolve: any, reject: any) =>
            Promise.resolve(value).then(resolve, reject);
        }
        return () => query(value);
      },
    },
  );
}

function model(handlers: Record<string, (...args: any[]) => unknown> = {}) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        // Not thenable, or Nest would await the provider value forever.
        if (prop === 'then' || typeof prop === 'symbol') return undefined;
        const handler = handlers[prop];
        return (...args: unknown[]) =>
          query(handler ? handler(...args) : prop === 'find' ? [] : null);
      },
    },
  );
}

describe('Access rules (e2e)', () => {
  let app: INestApplication;
  let tokenFor: (userId: string) => string;

  beforeAll(async () => {
    const builder = Test.createTestingModule({ imports: [TestAppModule] });
    const overrides: Array<[string, unknown]> = [
      [
        User.name,
        model({ findById: (userId: string) => users[userId] ?? null }),
      ],
      [
        Psychologist.name,
        model({
          findOne: (filter: { user?: string }) =>
            psychologistsByUser[String(filter?.user)] ?? null,
        }),
      ],
      [
        TherapyRequest.name,
        model({
          findById: (requestId: string) =>
            requestId === REQUEST_OF_P2
              ? { _id: REQUEST_OF_P2, psychologist: P2 }
              : null,
        }),
      ],
      [TherapySession.name, model()],
      [Notification.name, model()],
      [Booking.name, model()],
      [Company.name, model()],
      [Room.name, model()],
      [Schedule.name, model()],
    ];
    for (const [name, value] of overrides) {
      builder.overrideProvider(getModelToken(name)).useValue(value);
    }

    app = (await builder.compile()).createNestApplication();
    await app.init();

    const jwt = app.get(JwtService);
    // Token roles are deliberately wrong: guards must use database roles.
    tokenFor = (userId) => jwt.sign({ userId, roles: ['admin'] });
  });

  afterAll(async () => {
    await app.close();
  });

  const contactsUpdate = {
    contacts: [{ network: 'telegram', id: '999', username: 'taker' }],
  };

  it.each([
    ['GET', '/psychologists', PLAIN, 403, null],
    ['GET', '/psychologists', ADMIN, 200, null],
    ['GET', '/booking-system/bookings', PLAIN, 403, null],
    ['GET', '/booking-system/bookings', ADMIN, 200, null],
    ['GET', '/users/me', DELETED, 401, null],
    ['PUT', `/users/${P1_USER}`, EDITOR, 403, contactsUpdate],
    ['PUT', `/users/${P1_USER}`, ADMIN, 200, contactsUpdate],
    [
      'GET',
      `/therapy-sessions/statistic/psychologist/${P2}/from/0/to/1`,
      EDITOR,
      403,
      null,
    ],
    [
      'GET',
      `/therapy-sessions/statistic/psychologist/${P2}/from/0/to/1`,
      ADMIN,
      200,
      null,
    ],
    ['GET', `/therapy-requests/${REQUEST_OF_P2}`, P1_USER, 403, null],
    ['GET', `/therapy-requests/${REQUEST_OF_P2}`, P2_USER, 200, null],
    ['GET', `/therapy-requests/${REQUEST_OF_P2}`, ADMIN, 200, null],
    ['POST', '/users', EDITOR, 403, { name: 'New', ...contactsUpdate }],
    ['GET', '/booking-system/bookings', EDITOR, 403, null],
    [
      'PUT',
      `/therapy-requests/${REQUEST_OF_P2}`,
      P1_USER,
      403,
      { psychologist: P1 },
    ],
    ['GET', '/therapy-sessions/statistic/from/0/to/1', ACCOUNTANT, 200, null],
    ['GET', '/therapy-sessions/statistic/from/0/to/1', EDITOR, 403, null],
  ] as Array<[string, string, string, number, object | null]>)(
    '%s %s as %s -> %i',
    async (method, path, userId, status, body) => {
      const call = request(app.getHttpServer())
        [method.toLowerCase() as 'get' | 'put' | 'post'](path)
        .set('Authorization', `Bearer ${tokenFor(userId)}`);

      await (body ? call.send(body) : call).expect(status);
    },
  );

  it('rate limits logins per client IP through the global throttler', async () => {
    const server = app.getHttpServer();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const response = await request(server).post('/auth/login/user').send({});
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10).every((status) => status !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
