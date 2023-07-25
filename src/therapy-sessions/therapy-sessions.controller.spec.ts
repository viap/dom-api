import { Test, TestingModule } from '@nestjs/testing';
import { TherapySessionsController } from './therapy-sessions.controller';

describe('TherapySessionsController', () => {
  let controller: TherapySessionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TherapySessionsController],
    }).compile();

    controller = module.get<TherapySessionsController>(TherapySessionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
