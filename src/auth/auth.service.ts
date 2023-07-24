import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Document } from 'mongoose';
import { ApiClientsService } from 'src/api-clients/api-clients.service';
import { ApiClientDto } from 'src/api-clients/dto/api-client.dto';
import { UsersService } from 'src/users/users.service';
import { TelegramUserDto } from './dto/telegram.dto';

@Injectable()
export class AuthService {
  constructor(
    private clientService: ApiClientsService,
    private jwtService: JwtService,
    private userService: UsersService,
  ) {}

  async signInByTelegram(
    initClient: ApiClientDto,
    telegram: TelegramUserDto,
  ): Promise<{ auth_token: string }> | never {
    const apiClient = await this.clientService.findOne(initClient.name);

    if (apiClient?.password !== initClient.password) {
      throw new UnauthorizedException();
    }

    const user = ((await this.userService.getByTelegramId(telegram.id)) ||
      (await this.userService.createFromTelegram(
        telegram,
      ))) as unknown as Document;

    const payload = { userId: user._id, clientName: apiClient.name };

    return { auth_token: await this.jwtService.signAsync(payload) };
  }
}
