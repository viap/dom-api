import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ClientDto } from 'src/clients/dto/client.dto';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { TelegramUserDto } from './dto/telegram.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login/telegram')
  @HttpCode(HttpStatus.OK)
  getAuthTokenForTelegram(
    @Body() data: { client: ClientDto; telegram: TelegramUserDto },
  ) {
    return this.authService.signInByTelegram(data.telegram, data.client);
  }
}
