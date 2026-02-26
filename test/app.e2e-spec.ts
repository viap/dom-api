import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
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

// Mock models for all MongoDB collections
const mockModel = {
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  exec: jest.fn(),
};

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(getModelToken(User.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(Notification.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(Psychologist.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(TherapySession.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(TherapyRequest.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(Company.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(Room.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(Schedule.name))
      .useValue(mockModel)
      .overrideProvider(getModelToken(Booking.name))
      .useValue(mockModel)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/auth/ping (GET)', () => {
    return request
      .agent(app.getHttpServer())
      .get('/auth/ping')
      .expect(200)
      .expect('pong');
  });

  it('/auth/check-token (GET) should fail without token', () => {
    return request
      .agent(app.getHttpServer())
      .get('/auth/check-token')
      .expect(401);
  });
});
