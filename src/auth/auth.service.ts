import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiClientsService } from 'src/api-clients/api-clients.service';
import { ApiClientDto } from 'src/api-clients/dto/api-client.dto';
import { UsersService } from 'src/users/users.service';
import { TelegramUserDto } from './dto/telegram.dto';
import { TokenPayloadDto } from './dto/token-payload.dto';

@Injectable()
export class AuthService {
  constructor(
    private clientService: ApiClientsService,
    private jwtService: JwtService,
    private userService: UsersService,
  ) {}

  async verifyToken(token: string): Promise<TokenPayloadDto | undefined> {
    return await this.jwtService.verifyAsync(token).catch(() => undefined);
  }

  async decode(
    token: string,
  ): Promise<Record<string, unknown> | string | null> {
    return this.jwtService.decode(token);
  }

  async isAvailableClient(initClient: ApiClientDto) {
    const apiClient = await this.clientService.findOne(initClient.name);

    if (apiClient?.password !== initClient.password) {
      return false;
    }

    return true;
  }

  async signInByTelegram(
    initClient: ApiClientDto,
    telegram: TelegramUserDto,
  ): Promise<{ auth_token: string }> | never {
    if (!this.isAvailableClient(initClient)) {
      throw new UnauthorizedException();
    }

    const user =
      (await this.userService.getByTelegramId(telegram.id)) ||
      (await this.userService.createFromTelegram(telegram));

    const payload: TokenPayloadDto = {
      userId: user._id,
      roles: user.roles,
      clientName: initClient.name,
    };

    return { auth_token: await this.jwtService.signAsync(payload) };
  }
}
