import { Injectable } from '@nestjs/common';
import { clientConstants } from './consts';
import { ApiClientDto } from './dto/api-client.dto';

@Injectable()
export class ApiClientsService {
  private readonly clients: Array<ApiClientDto> = clientConstants.apiClients;
  async findOne(name: string): Promise<ApiClientDto | undefined> {
    return this.clients.find((client) => client.name === name);
  }
}
