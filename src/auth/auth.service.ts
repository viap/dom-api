import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Document } from 'mongoose';
import { ClientsService } from 'src/clients/clients.service';
import { ClientDto } from 'src/clients/dto/client.dto';
import { UsersService } from 'src/users/users.service';
import { TelegramUserDto } from './dto/telegram.dto';

@Injectable()
export class AuthService {
  constructor(
    private clientService: ClientsService,
    private jwtService: JwtService,
    private userService: UsersService,
  ) {}

  async signInByTelegram(
    initClient: ClientDto,
    telegram: TelegramUserDto,
  ): Promise<{ auth_token: string }> | never {
    const client = await this.clientService.findOne(initClient.name);

    if (client?.password !== initClient.password) {
      throw new UnauthorizedException();
    }

    const user = ((await this.userService.getByTelegramId(telegram.id)) ||
      (await this.userService.createFromTelegram(
        telegram,
      ))) as unknown as Document;

    const payload = { userId: user._id, clientName: client.name };

    return { auth_token: await this.jwtService.signAsync(payload) };
  }
}
