import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
} from '@nestjs/common';
import { JoiValidationPipe } from 'src/joi/joi.pipe';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import {
  AuthByTelegramDto,
  authByTelegramSchema,
} from './dto/auth-by-telegram.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login/telegram')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new JoiValidationPipe(authByTelegramSchema))
  getAuthTokenForTelegram(@Body() data: AuthByTelegramDto) {
    return this.authService.signInByTelegram(data.client, data.telegram);
  }
}
