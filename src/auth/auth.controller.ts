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
import { AuthByTelegramDto } from './dto/auth-by-telegram.dto';
import { joiAuthByTelegramSchema } from './schemas/joi.auth-by-telegram.schema';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login/telegram')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new JoiValidationPipe(joiAuthByTelegramSchema))
  getAuthTokenForTelegram(@Body() data: AuthByTelegramDto) {
    return this.authService.signInByTelegram(data.apiClient, data.telegram);
  }
}
