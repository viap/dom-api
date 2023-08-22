import { Test, TestingModule } from '@nestjs/testing';
import { TherapyRequestsService } from './therapy-requests.service';

describe('RequestsService', () => {
  let service: TherapyRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TherapyRequestsService],
    }).compile();

    service = module.get<TherapyRequestsService>(TherapyRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
