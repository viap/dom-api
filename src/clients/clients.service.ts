import { Injectable } from '@nestjs/common';

export type Client = {
  id: number;
  name: string;
  password: string;
};

@Injectable()
export class ClientsService {
  private readonly clients: Array<Client> = [
    {
      id: 1,
      name: 'domBot',
      password: 'Knock-Knock-Bot',
    },
  ];

  async findOne(name: string): Promise<Client | undefined> {
    return this.clients.find((client) => client.name === name);
  }
}
