import { Injectable } from '@nestjs/common';
import { ApiClientDto } from './dto/api-client.dto';

@Injectable()
export class ApiClientsService {
  private readonly clients: Array<ApiClientDto> = [
    {
      name: process.env.BOT_CLIENT_NAME,
      password: process.env.BOT_CLIENT_PASSWORD,
    },
  ];
  async findOne(name: string): Promise<ApiClientDto | undefined> {
    return this.clients.find((client) => client.name === name);
  }
}
