import { Module } from '@nestjs/common';
import { ApiClientsService } from './api-clients.service';

@Module({
  providers: [ApiClientsService],
  exports: [ApiClientsService],
})
export class ApiClientsModule {}
