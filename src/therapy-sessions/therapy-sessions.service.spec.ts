import { Test, TestingModule } from '@nestjs/testing';
import { TherapySessionsService } from './therapy-sessions.service';

describe('TherapySessionsService', () => {
  let service: TherapySessionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TherapySessionsService],
    }).compile();

    service = module.get<TherapySessionsService>(TherapySessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
