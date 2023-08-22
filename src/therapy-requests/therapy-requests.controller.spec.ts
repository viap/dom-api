import { Test, TestingModule } from '@nestjs/testing';
import { TherapyRequestsController } from './therapy-requests.controller';

describe('RequestsController', () => {
  let controller: TherapyRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TherapyRequestsController],
    }).compile();

    controller = module.get<TherapyRequestsController>(
      TherapyRequestsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
