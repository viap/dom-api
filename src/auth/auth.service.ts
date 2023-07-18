import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientsService } from 'src/clients/clients.service';

@Injectable()
export class AuthService {
  constructor(
    private clientService: ClientsService,
    private jwtService: JwtService,
  ) {}

  async signIn(
    name: string,
    password: string,
  ): Promise<{ auth_token: string }> | never {
    const client = await this.clientService.findOne(name);

    if (client?.password !== password) {
      throw new UnauthorizedException();
    }

    const payload = { sub: client.id, username: client.name };

    return { auth_token: await this.jwtService.signAsync(payload) };
  }
}
