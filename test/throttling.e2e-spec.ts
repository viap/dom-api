import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AppThrottlerGuard } from '../src/common/guards/app-throttler.guard';

@Controller('probe')
class ProbeController {
  @Get('open')
  open() {
    return 'ok';
  }

  @Get('limited')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  limited() {
    return 'ok';
  }

  @Post('write')
  write() {
    return 'ok';
  }
}

describe('Global throttling (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 3 }]),
        JwtModule.register({ secret: 'x'.repeat(32) }),
      ],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('limits writes with the global default', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 3; i++) {
      await request(server).post('/probe/write').expect(201);
    }
    await request(server).post('/probe/write').expect(429);
  });

  it('keeps anonymous reads without @Throttle unlimited', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 5; i++) {
      await request(server).get('/probe/open').expect(200);
    }
  });

  it('applies route @Throttle to anonymous reads', async () => {
    const server = app.getHttpServer();
    await request(server).get('/probe/limited').expect(200);
    await request(server).get('/probe/limited').expect(200);
    await request(server).get('/probe/limited').expect(429);
  });
});
