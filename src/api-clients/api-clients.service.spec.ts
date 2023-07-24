import { Test, TestingModule } from '@nestjs/testing';
import { ApiClientsService } from './api-clients.service';

describe('ClientsService', () => {
  let service: ApiClientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiClientsService],
    }).compile();

    service = module.get<ApiClientsService>(ApiClientsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
