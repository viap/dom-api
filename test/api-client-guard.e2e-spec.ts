import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApiClientGuard } from '../src/api-clients/api-client.guard';
import { ApplicationMessagesController } from '../src/applications/application-messages.controller';
import { ApplicationMessagesService } from '../src/applications/application-messages.service';
import { TelegramContactController } from '../src/telegram-contact/telegram-contact.controller';
import { TelegramContactService } from '../src/telegram-contact/telegram-contact.service';

describe('ApiClientGuard wiring (e2e)', () => {
  let app: INestApplication;
  const previousName = process.env.BOT_CLIENT_NAME;
  const previousPassword = process.env.BOT_CLIENT_PASSWORD;
  const previousWebName = process.env.WEB_CLIENT_NAME;
  const previousWebPassword = process.env.WEB_CLIENT_PASSWORD;

  beforeAll(async () => {
    process.env.BOT_CLIENT_NAME = 'e2e-bot';
    process.env.BOT_CLIENT_PASSWORD = 'e2e-secret';
    process.env.WEB_CLIENT_NAME = 'e2e-web';
    process.env.WEB_CLIENT_PASSWORD = 'e2e-web-secret';
    const module = await Test.createTestingModule({
      controllers: [ApplicationMessagesController, TelegramContactController],
      providers: [
        { provide: APP_GUARD, useClass: ApiClientGuard },
        { provide: ApplicationMessagesService, useValue: {} },
        { provide: TelegramContactService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousName === undefined) delete process.env.BOT_CLIENT_NAME;
    else process.env.BOT_CLIENT_NAME = previousName;
    if (previousPassword === undefined) delete process.env.BOT_CLIENT_PASSWORD;
    else process.env.BOT_CLIENT_PASSWORD = previousPassword;
    if (previousWebName === undefined) delete process.env.WEB_CLIENT_NAME;
    else process.env.WEB_CLIENT_NAME = previousWebName;
    if (previousWebPassword === undefined)
      delete process.env.WEB_CLIENT_PASSWORD;
    else process.env.WEB_CLIENT_PASSWORD = previousWebPassword;
  });

  it.each([
    '/telegram-contact/link',
    '/telegram-contact/link/confirm',
    '/telegram-contact/link/cancel',
    '/telegram-contact/link/status',
    '/telegram-contact/session',
    '/telegram-contact/forget',
    '/application-messages/claim',
    '/application-messages/report',
    '/application-messages/threads',
    '/application-messages/reply',
  ])('protects the real service route %s before validation', async (path) => {
    await request(app.getHttpServer())
      .post(path)
      .send({ apiClient: { name: 'invalid', password: 'invalid' } })
      .expect(401);
  });

  it.each([
    [
      '/application-messages/report',
      { name: 'e2e-bot', password: 'e2e-secret' },
    ],
    [
      '/telegram-contact/link/status',
      { name: 'e2e-web', password: 'e2e-web-secret' },
    ],
  ])(
    'runs body validation after authenticating %s',
    async (path, apiClient) => {
      await request(app.getHttpServer())
        .post(path)
        .send({ apiClient })
        .expect(400);
    },
  );
});
