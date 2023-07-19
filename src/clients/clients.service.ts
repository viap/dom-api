import { Injectable } from '@nestjs/common';
import { clientConstants } from './consts';
import { ClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  private readonly clients: Array<ClientDto> = clientConstants.clients;
  async findOne(name: string): Promise<ClientDto | undefined> {
    return this.clients.find((client) => client.name === name);
  }
}
